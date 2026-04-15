"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

interface Category {
  id: string;
  name: string;
  created_at?: string;
}

interface CategoryFormInputs {
  name: string;
}

export default function CategoryManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CategoryFormInputs>();

  const fetchCategories = async () => {
    try {
      const resp = await fetch("http://127.0.0.1:8000/categories");
      const data = await resp.json();
      if (data.status === "success") {
        setCategories(data.categories);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const onSubmit = async (data: CategoryFormInputs) => {
    setErrorMsg(null);
    setIsLoading(true);

    const nameToSubmit = data.name.trim();

    if (!nameToSubmit) {
      setErrorMsg("Category name cannot be empty");
      setIsLoading(false);
      return;
    }

    try {
      const url = editingId
        ? `http://127.0.0.1:8000/categories/${editingId}`
        : "http://127.0.0.1:8000/categories";

      const method = editingId ? "PUT" : "POST";

      const resp = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameToSubmit }),
      });

      const result = await resp.json();

      if (!resp.ok) {
        setErrorMsg(result.detail || "An error occurred");
      } else {
        await fetchCategories();
        reset();
        setEditingId(null);
      }
    } catch (e: any) {
      setErrorMsg("Failed to save category");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (cat: Category) => {
    setEditingId(cat.id);
    setValue("name", cat.name);
    setErrorMsg(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    reset();
    setErrorMsg(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this category?")) return;
    try {
      const resp = await fetch(`http://127.0.0.1:8000/categories/${id}`, {
        method: "DELETE",
      });
      if (resp.ok) {
        await fetchCategories();
      } else {
        const result = await resp.json();
        alert(result.detail || "Error deleting category");
      }
    } catch (e) {
      alert("Failed to delete category");
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow w-full text-left flex flex-col h-[500px]">
      <h2 className="text-xl font-semibold mb-4">Manage Categories</h2>

      {errorMsg && (
        <div className="mb-4 text-red-600 bg-red-50 p-2 rounded">
          {errorMsg}
        </div>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="mb-6 flex flex-col gap-2 shrink-0"
      >
        <div>
          <input
            {...register("name", {
              required: "Category name is required",
              validate: (value) =>
                value.trim().length > 0 ||
                "Category name cannot be empty spaces",
            })}
            placeholder="Category Name"
            className="border p-2 rounded w-full"
            disabled={isLoading}
          />
          {errors.name && (
            <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isLoading}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {editingId ? "Update Category" : "Add Category"}
          </button>

          {editingId && (
            <button
              type="button"
              onClick={handleCancelEdit}
              disabled={isLoading}
              className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="flex-1 overflow-y-auto border border-gray-200 rounded divide-y hide-scrollbar">
        {categories.length === 0 ? (
          <p className="p-4 text-gray-500 text-center">No categories found.</p>
        ) : (
          categories.map((cat) => (
            <div
              key={cat.id}
              className="flex justify-between items-center p-3 hover:bg-gray-50"
            >
              <span
                className="font-medium text-gray-800 truncate"
                title={cat.name}
              >
                {cat.name}
              </span>
              <div className="flex gap-2 shrink-0 ml-4">
                <button
                  onClick={() => handleEdit(cat)}
                  className="text-sm text-blue-600 hover:text-blue-800 px-2 py-1 bg-blue-50 rounded"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(cat.id)}
                  className="text-sm text-red-600 hover:text-red-800 px-2 py-1 bg-red-50 rounded"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
