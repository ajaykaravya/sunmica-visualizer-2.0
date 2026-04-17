const API_BASE_URL = "http://127.0.0.1:8000";

export interface Category {
    id: string;
    name: string;
}

// Fetch all categories
export const fetchCategories = async (): Promise<Category[]> => {
    try {
        const response = await fetch(`${API_BASE_URL}/categories`);

        if (!response.ok) {
            throw new Error(`Failed to fetch categories: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.status === "success") {
            return data.categories;
        }

        throw new Error(data.detail || "Unknown error occurred");
    } catch (error) {
        console.error("Error fetching categories:", error);
        throw error;
    }
};

// Create a new category
export const createCategory = async (name: string): Promise<Category> => {
    try {
        const trimmedName = name.trim();

        if (!trimmedName) {
            throw new Error("Category name cannot be empty");
        }

        const response = await fetch(`${API_BASE_URL}/categories`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: trimmedName }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Failed to create category");
        }

        return data;
    } catch (error) {
        console.error("Error creating category:", error);
        throw error;
    }
};

// Update a category
export const updateCategory = async (id: string, name: string): Promise<Category> => {
    try {
        const trimmedName = name.trim();

        if (!trimmedName) {
            throw new Error("Category name cannot be empty");
        }

        const response = await fetch(`${API_BASE_URL}/categories/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: trimmedName }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Failed to update category");
        }

        return data;
    } catch (error) {
        console.error("Error updating category:", error);
        throw error;
    }
};

// Delete a category
export const deleteCategory = async (id: string): Promise<void> => {
    try {
        const response = await fetch(`${API_BASE_URL}/categories/${id}`, {
            method: "DELETE",
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || "Failed to delete category");
        }
    } catch (error) {
        console.error("Error deleting category:", error);
        throw error;
    }
};
