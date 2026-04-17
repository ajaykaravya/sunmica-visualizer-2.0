const API_BASE_URL = "http://127.0.0.1:8000";

export interface Sunmica {
    id: string;
    name: string;
    filename: string;
    url: string;
}

export interface SunmicaUploadData {
    name: string;
    file: File;
}

// Fetch all sunmica images
export const fetchSunmicas = async (): Promise<Sunmica[]> => {
    try {
        const response = await fetch(`${API_BASE_URL}/sunmica/images`);

        if (!response.ok) {
            throw new Error(`Failed to fetch sunmica images: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.status === "success") {
            return data.images;
        }

        throw new Error(data.detail || "Unknown error occurred");
    } catch (error) {
        console.error("Error fetching sunmica images:", error);
        throw error;
    }
};

// Upload sunmica image
export const uploadSunmica = async (sunmicaData: SunmicaUploadData): Promise<Sunmica> => {
    try {
        if (!sunmicaData.file) {
            throw new Error("File is required");
        }

        if (!sunmicaData.name.trim()) {
            throw new Error("Sunmica name is required");
        }

        const formData = new FormData();
        formData.append("file", sunmicaData.file);
        formData.append("name", sunmicaData.name);

        const response = await fetch(`${API_BASE_URL}/sunmica/upload`, {
            method: "POST",
            body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Failed to upload sunmica");
        }

        return data;
    } catch (error) {
        console.error("Error uploading sunmica:", error);
        throw error;
    }
};

// Delete sunmica image
export const deleteSunmica = async (id: string): Promise<void> => {
    try {
        const response = await fetch(`${API_BASE_URL}/sunmica/${id}`, {
            method: "DELETE",
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || "Failed to delete sunmica");
        }
    } catch (error) {
        console.error("Error deleting sunmica:", error);
        throw error;
    }
};
