"use client";

import { useEffect, useState } from "react";
import {
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { useForm } from "react-hook-form";
import {
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  Category,
} from "@/lib/api/categories";
import { showSuccessToast, showErrorToast } from "@/lib/toast";

interface CategoryFormInputs {
  name: string;
}

export default function CategoryManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CategoryFormInputs>({
    defaultValues: { name: "" },
  });

  const loadCategories = async () => {
    try {
      const data = await fetchCategories();
      setCategories(data);
    } catch (error) {
      console.error("Failed to load categories:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to load categories";
      showErrorToast(errorMessage);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const onSubmit = async (data: CategoryFormInputs) => {
    setIsLoading(true);

    try {
      if (editingId) {
        await updateCategory(editingId, data.name);
        showSuccessToast("Category updated successfully");
      } else {
        await createCategory(data.name);
        showSuccessToast("Category created successfully");
      }

      await loadCategories();
      reset();
      setEditingId(null);
      setOpen(false);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to save category";
      showErrorToast(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (cat: Category) => {
    setEditingId(cat.id);
    setValue("name", cat.name);
    setOpen(true); // ✅ open modal for edit
  };

  const handleAdd = () => {
    setEditingId(null);
    reset();
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this category?")) return;

    try {
      await deleteCategory(id);
      showSuccessToast("Category deleted successfully");
      await loadCategories();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Delete failed";
      showErrorToast(errorMessage);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow w-full flex flex-col h-[500px]">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Manage Categories</h2>

        <Button variant="contained" onClick={handleAdd}>
          Add Category
        </Button>
      </div>

      {/* Modal */}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          {editingId ? "Edit Category" : "Add Category"}
        </DialogTitle>

        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent className="flex flex-col gap-4 mt-2">
            <TextField
              {...register("name", {
                required: "Category name is required",
                validate: (value) =>
                  value.trim().length > 0 || "Category name cannot be empty",
              })}
              label="Category Name"
              size="small"
              error={!!errors.name}
              helperText={errors.name?.message}
              fullWidth
            />
          </DialogContent>

          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancel</Button>

            <Button type="submit" variant="contained" disabled={isLoading}>
              {isLoading ? "Saving..." : editingId ? "Update" : "Add"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* List */}
      <div className="flex-1 overflow-y-auto border rounded divide-y">
        {categories.length === 0 ? (
          <p className="p-4 text-gray-500 text-center">No categories found.</p>
        ) : (
          categories.map((cat) => (
            <div
              key={cat.id}
              className="flex justify-between items-center p-3 hover:bg-gray-50"
            >
              <span className="font-medium truncate">{cat.name}</span>

              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(cat)}
                  className="text-blue-600 bg-blue-50 px-2 py-1 rounded"
                >
                  Edit
                </button>

                <button
                  onClick={() => handleDelete(cat.id)}
                  className="text-red-600 bg-red-50 px-2 py-1 rounded"
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
