const API_BASE_URL = "http://127.0.0.1:8000";

export interface Furniture {
    id: string;
    filename: string;
    url: string;
    categoryId?: string;
    furniture_name?: string;
}

export interface FurnitureUploadData {
    furniture_name: string;
    categoryId: string;
    file: File;
}

// Fetch all furniture
export const fetchFurniture = async (): Promise<Furniture[]> => {
    try {
        const response = await fetch(`${API_BASE_URL}/furniture/images`);

        if (!response.ok) {
            throw new Error(`Failed to fetch furniture: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.status === "success") {
            return data.images;
        }

        throw new Error(data.detail || "Unknown error occurred");
    } catch (error) {
        console.error("Error fetching furniture:", error);
        throw error;
    }
};

// Upload furniture image
export const uploadFurniture = async (furnitureData: FurnitureUploadData): Promise<Furniture> => {
    try {
        if (!furnitureData.file) {
            throw new Error("File is required");
        }

        if (!furnitureData.furniture_name.trim()) {
            throw new Error("Furniture name is required");
        }

        if (!furnitureData.categoryId) {
            throw new Error("Category is required");
        }

        const formData = new FormData();
        formData.append("file", furnitureData.file);
        formData.append("furniture_name", furnitureData.furniture_name);
        formData.append("categoryId", furnitureData.categoryId);

        const response = await fetch(`${API_BASE_URL}/furniture/upload`, {
            method: "POST",
            body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Failed to upload furniture");
        }

        return data;
    } catch (error) {
        console.error("Error uploading furniture:", error);
        throw error;
    }
};

// Delete furniture
export const deleteFurniture = async (id: string): Promise<void> => {
    try {
        const response = await fetch(`${API_BASE_URL}/furniture/${id}`, {
            method: "DELETE",
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || "Failed to delete furniture");
        }
    } catch (error) {
        console.error("Error deleting furniture:", error);
        throw error;
    }
};
