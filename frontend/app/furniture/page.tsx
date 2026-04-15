"use client";

import { useEffect, useState } from "react";

interface Furniture {
  id: string;
  filename: string;
  url: string;
  categoryId?: string;
  furniture_name?: string;
}

interface Category {
  id: string;
  name: string;
}

export default function FurniturePage() {
  const [furnitureList, setFurnitureList] = useState<Furniture[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [file, setFile] = useState<File | null>(null);
  const [furnitureName, setFurnitureName] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch furniture
  const fetchFurniture = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/furniture/images");
      const data = await res.json();
      if (data.status === "success") {
        setFurnitureList(data.images);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch categories (for dropdown)
  const fetchCategories = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/categories");
      const data = await res.json();
      if (data.status === "success") {
        setCategories(data.categories);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchFurniture();
    fetchCategories();
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!file) {
      setErrorMsg("Please select an image");
      return;
    }

    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("furniture_name", furnitureName);
      formData.append("categoryId", categoryId);

      const res = await fetch("http://127.0.0.1:8000/furniture/upload", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();

      if (!res.ok) {
        setErrorMsg(result.detail || "Upload failed");
      } else {
        setFile(null);
        setFurnitureName("");
        setCategoryId("");
        await fetchFurniture();
      }
    } catch (err) {
      setErrorMsg("Upload failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this furniture?")) return;

    try {
      const res = await fetch(`http://127.0.0.1:8000/furniture/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchFurniture();
      } else {
        const data = await res.json();
        alert(data.detail || "Delete failed");
      }
    } catch {
      alert("Error deleting");
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow w-full flex flex-col h-[650px]">
      <h2 className="text-xl font-semibold mb-4">Manage Furniture</h2>

      {errorMsg && (
        <div className="mb-4 text-red-600 bg-red-50 p-2 rounded">
          {errorMsg}
        </div>
      )}

      {/* Upload Form */}
      <form onSubmit={handleUpload} className="flex flex-col gap-3 mb-6">
        <input
          type="text"
          placeholder="Furniture Name"
          value={furnitureName}
          onChange={(e) => setFurnitureName(e.target.value)}
          className="border p-2 rounded"
        />

        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="">Select Category</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>

        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="border p-2 rounded"
        />

        <button
          type="submit"
          disabled={isLoading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? "Uploading..." : "Upload Furniture"}
        </button>
      </form>

      {/* List */}
      <div className="flex-1 overflow-y-auto border rounded divide-y">
        {furnitureList.length === 0 ? (
          <p className="p-4 text-gray-500 text-center">No furniture uploaded</p>
        ) : (
          furnitureList.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-3 hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <img
                  src={item.url}
                  alt={item.furniture_name}
                  className="w-16 h-16 object-cover rounded border"
                />
                <div>
                  <div className="font-medium">
                    {item.furniture_name || "No Name"}
                  </div>
                  <div className="text-sm text-gray-500">
                    Category:{" "}
                    {categories.find((c) => c.id === item.categoryId)?.name ||
                      "None"}
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleDelete(item.id)}
                className="text-red-600 bg-red-50 px-3 py-1 rounded hover:bg-red-100"
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
