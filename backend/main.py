from typing import Optional
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from pydantic import BaseModel, Field
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np
from segment_anything import SamPredictor, sam_model_registry
import torch
import hashlib
import os
import uuid
from fastapi.responses import FileResponse
import mysql.connector

app = FastAPI()

# MySQL Database Setup
DB_CONFIG = {
    'user': 'root',
    'password': 'root1234',
    'host': '127.0.0.1'
}

def get_db_connection():
    try:
        conn = mysql.connector.connect(**DB_CONFIG, database='sunmica_visualizer')
        return conn
    except mysql.connector.Error as err:
        if err.errno == mysql.connector.errorcode.ER_BAD_DB_ERROR:
            # Auto-create database if it is missing
            setup_conn = mysql.connector.connect(**DB_CONFIG)
            cursor = setup_conn.cursor()
            cursor.execute("CREATE DATABASE IF NOT EXISTS sunmica_visualizer")
            setup_conn.commit()
            cursor.close()
            setup_conn.close()
            return mysql.connector.connect(**DB_CONFIG, database='sunmica_visualizer')
        raise

def init_db():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS furniture_images (
                id VARCHAR(36) PRIMARY KEY,
                filename VARCHAR(255) NOT NULL,
                url VARCHAR(255) NOT NULL,
                categoryId VARCHAR(255),
                furniture_name VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS categories (
                id VARCHAR(36) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS sunmica_images (
                id VARCHAR(36) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                filename VARCHAR(255) NOT NULL,
                url VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.commit()
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"Database initialization failed: {e}")

init_db()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.get("/static_images/{filename}")
async def get_image(filename: str):
    file_path = os.path.join(UPLOAD_DIR, filename)
    if os.path.exists(file_path):
        return FileResponse(file_path)
    raise HTTPException(status_code=404, detail="File not found")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins to fix 127.0.0.1 vs localhost cross-origin blocking
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load SAM model
MODEL_TYPE = "vit_b"
CHECKPOINT_PATH = "sam_vit_b.pth"  # Place the downloaded model here

try:
    sam = sam_model_registry[MODEL_TYPE](checkpoint=CHECKPOINT_PATH)
    device = "cpu"
    if torch.cuda.is_available():
        device = "cuda"
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        device = "mps"
    print(f"Loading model to {device}...")
    sam.to(device=device)
    predictor = SamPredictor(sam)
    print("SAM model loaded successfully")
except Exception as e:
    print(f"Error loading SAM model: {e}")
    predictor = None

embedding_cache = {}

@app.post("/furniture/upload")
async def upload_furniture(
    file: UploadFile = File(...),
    categoryId: Optional[str] = Form(default=None),
    furniture_name: Optional[str] = Form(default=None)
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename")
    
    file_extension = file.filename.split(".")[-1]
    image_id = str(uuid.uuid4())
    new_filename = f"{image_id}.{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, new_filename)
    
    contents = await file.read()
    with open(file_path, "wb") as f:
        f.write(contents)
        
    image_url = f"http://127.0.0.1:8000/static_images/{new_filename}"
    img_data = {
        "id": image_id, 
        "filename": new_filename, 
        "url": image_url, 
        "categoryId": categoryId, 
        "furniture_name": furniture_name
    }
    
    # Save standard record mapping to Database persistently
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO furniture_images (id, filename, url, categoryId, furniture_name) VALUES (%s, %s, %s, %s, %s)", 
        (image_id, new_filename, image_url, categoryId, furniture_name)
    )
    conn.commit()
    cursor.close()
    conn.close()
    
    # Pre-embed the image so it is immediately cached for this server node
    if predictor:
        try:
            image_array = cv2.imread(file_path)
            if image_array is not None:
                image_array = cv2.cvtColor(image_array, cv2.COLOR_BGR2RGB)
                predictor.set_image(image_array)
                embedding_cache[image_id] = {
                    "features": predictor.features,
                    "original_size": predictor.original_size,
                    "input_size": predictor.input_size
                }
        except Exception as e:
            print(f"Admin pre-embedding failed: {e}")
            
    return {"status": "success", "data": img_data}

@app.get("/furniture/images")
async def list_furniture_images():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, filename, url, categoryId, furniture_name FROM furniture_images ORDER BY created_at DESC")
        results = cursor.fetchall()
        cursor.close()
        conn.close()
        return {"status": "success", "images": results}
    except Exception as e:
        print(f"Error fetching images: {e}")
        return {"status": "error", "images": []}

@app.delete("/furniture/{image_id}")
async def delete_furniture(image_id: str):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute(
        "SELECT filename FROM furniture_images WHERE id=%s",
        (image_id,)
    )
    result = cursor.fetchone()

    if not result:
        raise HTTPException(status_code=404, detail="Not found")

    file_path = os.path.join(UPLOAD_DIR, result["filename"])

    cursor.execute(
        "DELETE FROM furniture_images WHERE id=%s",
        (image_id,)
    )
    conn.commit()

    cursor.close()
    conn.close()

    if os.path.exists(file_path):
        os.remove(file_path)

    return {"status": "success"}




@app.post("/sunmica/upload")
async def upload_sunmica(
    file: UploadFile = File(...),
    name: Optional[str] = Form(default=None)
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename")
    
    # Generate unique ID
    file_extension = file.filename.split(".")[-1]
    sunmica_id = str(uuid.uuid4())
    new_filename = f"{sunmica_id}.{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, new_filename)
    
    # Save file
    contents = await file.read()
    with open(file_path, "wb") as f:
        f.write(contents)
        
    # Generate URL
    image_url = f"http://127.0.0.1:8000/static_images/{new_filename}"
    
    sunmica_data = {
        "id": sunmica_id,
        "name": name,
        "filename": new_filename,
        "url": image_url
    }
    
    # Save to DB
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO sunmica_images (id, name, filename, url) VALUES (%s, %s, %s, %s)", 
        (sunmica_id, name, new_filename, image_url)
    )
    conn.commit()
    cursor.close()
    conn.close()
    
    return {"status": "success", "data": sunmica_data}

@app.get("/sunmica/images")
async def list_sunmica_images():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, name, filename, url FROM sunmica_images ORDER BY created_at DESC")
        results = cursor.fetchall()
        cursor.close()
        conn.close()
        return {"status": "success", "images": results}
    except Exception as e:
        print(f"Error fetching images: {e}")
        return {"status": "error", "images": []}

@app.delete("/sunmica/{sunmica_id}")
async def delete_sunmica(sunmica_id: str):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    # Get file first
    cursor.execute(
        "SELECT filename FROM sunmica_images WHERE id=%s",
        (sunmica_id,)
    )
    result = cursor.fetchone()

    if not result:
        raise HTTPException(status_code=404, detail="Not found")

    file_path = os.path.join(UPLOAD_DIR, result["filename"])

    # Delete DB
    cursor.execute(
        "DELETE FROM sunmica_images WHERE id=%s",
        (sunmica_id,)
    )
    conn.commit()

    cursor.close()
    conn.close()

    # Delete file
    if os.path.exists(file_path):
        os.remove(file_path)

    return {"status": "success"}

@app.post("/embed")
async def embed_image(image_id: str = Form(...)):
    if predictor is None:
        raise HTTPException(status_code=500, detail="SAM model not loaded")

    # Fetch mapping exclusively from database
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT filename FROM furniture_images WHERE id = %s", (image_id,))
    img_data = cursor.fetchone()
    cursor.close()
    conn.close()

    if not img_data:
        raise HTTPException(status_code=404, detail="Image not found in Database")
        
    if image_id not in embedding_cache:
        file_path = os.path.join(UPLOAD_DIR, img_data["filename"])
        if not os.path.exists(file_path):
             raise HTTPException(status_code=404, detail="File missing on disk")
             
        # Read from disk
        image = cv2.imread(file_path)
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB) # Ensure correct color format
        
        # Calculate and cache
        predictor.set_image(image)
        embedding_cache[image_id] = {
            "features": predictor.features,
            "original_size": predictor.original_size,
            "input_size": predictor.input_size
        }
        
    return {"status": "success"}

@app.post("/segment")
async def segment_image(image_id: str = Form(...), x: int = Form(...), y: int = Form(...)):
    if predictor is None:
        raise HTTPException(status_code=500, detail="SAM model not loaded")

    if image_id not in embedding_cache:
        raise HTTPException(status_code=400, detail="Image must be embedded first")
        
    # Reload embedding into predictor
    cache = embedding_cache[image_id]
    predictor.features = cache["features"]
    predictor.original_size = cache["original_size"]
    predictor.input_size = cache["input_size"]
    predictor.is_image_set = True

    # Predict mask
    input_point = np.array([[x, y]])
    input_label = np.array([1])

    masks, scores, logits = predictor.predict(
        point_coords=input_point,
        point_labels=input_label,
        multimask_output=True,
    )

    # Get the mask with highest score
    best_mask = masks[np.argmax(scores)]
    mask_list = best_mask.tolist()

    return {"mask": mask_list}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)


class Category(BaseModel):
    name: str = Field(..., min_length=1, description="Category name cannot be empty")

@app.post("/categories")
async def create_category(category: Category):
    category.name = category.name.strip()
    if not category.name:
        raise HTTPException(status_code=400, detail="Category name cannot be empty")
        
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT id FROM categories WHERE name = %s", (category.name,))
        if cursor.fetchone():
            cursor.close()
            conn.close()
            raise HTTPException(status_code=400, detail="Category with this name already exists")
            
        category_id = str(uuid.uuid4())
        cursor.execute(
            "INSERT INTO categories (id, name) VALUES (%s, %s)", 
            (category_id, category.name)
        )
        conn.commit()
        cursor.close()
        conn.close()
        return {"status": "success", "data": {"id": category_id, "name": category.name}}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating category: {e}")
        raise HTTPException(status_code=500, detail="Failed to create category")

@app.get("/categories")
async def list_categories():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, name, created_at FROM categories ORDER BY created_at DESC")
        results = cursor.fetchall()
        cursor.close()
        conn.close()
        return {"status": "success", "categories": results}
    except Exception as e:
        print(f"Error fetching categories: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch categories")

@app.put("/categories/{category_id}")
async def update_category(category_id: str, category: Category):
    category.name = category.name.strip()
    if not category.name:
        raise HTTPException(status_code=400, detail="Category name cannot be empty")
        
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT id FROM categories WHERE name = %s AND id != %s", (category.name, category_id))
        if cursor.fetchone():
            cursor.close()
            conn.close()
            raise HTTPException(status_code=400, detail="Category with this name already exists")

        cursor.execute("UPDATE categories SET name = %s WHERE id = %s", (category.name, category_id))
        if cursor.rowcount == 0:
            cursor.close()
            conn.close()
            raise HTTPException(status_code=404, detail="Category not found")
        conn.commit()
        cursor.close()
        conn.close()
        return {"status": "success", "data": {"id": category_id, "name": category.name}}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating category: {e}")
        raise HTTPException(status_code=500, detail="Failed to update category")

@app.delete("/categories/{category_id}")
async def delete_category(category_id: str):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM categories WHERE id = %s", (category_id,))
        if cursor.rowcount == 0:
            cursor.close()
            conn.close()
            raise HTTPException(status_code=404, detail="Category not found")
        conn.commit()
        cursor.close()
        conn.close()
        return {"status": "success", "message": "Category deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting category: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete category")
