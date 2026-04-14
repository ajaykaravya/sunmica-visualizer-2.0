# 🪵 Sunmica Visualizer (AI-Based Furniture Preview)

An AI-powered web application that allows users to upload furniture images, click on any part (door, drawer, panel), and apply sunmica (laminate) textures in real-time.

---

# 🚀 Features

- Upload furniture images
- Click on any part of furniture
- AI detects clicked region using Segment Anything Model (SAM)
- Apply sunmica texture to selected region
- Real-time preview
- Scalable architecture (Next.js + FastAPI)

---

# 🧠 Tech Stack

### Frontend

- Next.js (React + TypeScript)
- HTML Canvas API
- Tailwind CSS (optional)

### Backend

- FastAPI (Python)
- Segment Anything Model (SAM)
- OpenCV
- PyTorch

---

# 🏗️ Architecture

```
User Click (x, y)
        ↓
Next.js Frontend
        ↓
FastAPI Backend (SAM)
        ↓
Returns Mask
        ↓
Canvas applies texture
```

---

# 📦 Project Structure

```
root/
│
├── frontend/         # Next.js app
│   ├── app/
│   ├── components/
│   └── public/
│
├── backend/          # FastAPI + SAM
│   ├── main.py
│   ├── model/
│   └── utils/
│
└── README.md
```

---

# ⚙️ Setup Instructions

## 1️⃣ Clone Repository

```
git clone <your-repo-url>
cd sunmica-visualizer
```

---

## 2️⃣ Frontend Setup (Next.js)

```
cd frontend
npm install
npm run dev
```

App runs on:

```
http://localhost:3000
```

---

## 3️⃣ Backend Setup (FastAPI + SAM)

### Create virtual environment

```
cd backend
python -m venv venv
source venv/bin/activate
```

### Install dependencies

```
pip install fastapi uvicorn opencv-python torch torchvision
pip install git+https://github.com/facebookresearch/segment-anything.git
```

---

## 4️⃣ Download SAM Model

Download checkpoint:

```
sam_vit_b.pth
```

Place it inside:

```
backend/
```

---

## 5️⃣ Run Backend Server

```
uvicorn main:app --reload
```

Backend runs on:

```
http://127.0.0.1:8000
```

---

# 🧪 API Endpoint

## POST `/segment`

### Request:

```
{
  "x": number,
  "y": number
}
```

### Response:

```
{
  "mask": [[0,1,1,0,...], ...]
}
```

---

# 🖼️ Frontend Logic

1. Render image on canvas
2. Capture click coordinates
3. Send (x, y) to backend
4. Receive mask
5. Apply texture inside mask

---

# 🎨 Texture Application Strategy

- Use Canvas API
- Clip region using mask
- Apply repeating texture using:

```
ctx.createPattern(textureImage, 'repeat')
```

---

# ⚠️ Important Notes

## 1. Coordinate Mapping

- Convert canvas click → original image coordinates

## 2. Image Size

- Resize large images (max ~1024px)

## 3. Performance

- Cache masks for repeated clicks

---

# 🔥 Future Improvements

- Auto-detect doors & drawers (custom ML model)
- Multiple selection support
- Undo / redo functionality
- Save/export preview images
- 3D preview using Three.js

---

# 📌 MVP Goal

Focus only on:

- Upload image
- Click → detect region
- Apply texture

Avoid over-engineering in first version.

---

# 📚 References

- Segment Anything Model (SAM)
- FastAPI Documentation
- Next.js Documentation

---

# 👨‍💻 Author

Your Name

---

# ⭐ Notes for Codex

- Keep code modular
- Use clean API structure
- Avoid blocking UI during API calls
- Optimize mask rendering
- Prefer simplicity over complexity in MVP
