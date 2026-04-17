"use client";

import { useEffect, useState } from "react";
import {
  TextField,
  Select,
  MenuItem,
  Button,
  FormControl,
  InputLabel,
  FormHelperText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { useForm, Controller } from "react-hook-form";
import {
  fetchFurniture,
  uploadFurniture,
  deleteFurniture,
  Furniture,
} from "@/lib/api/furniture";
import { fetchCategories, Category } from "@/lib/api/categories";
import { showSuccessToast, showErrorToast } from "@/lib/toast";

interface FurnitureForm {
  furniture_name: string;
  categoryId: string;
  file: FileList;
}

export default function FurniturePage() {
  const [furnitureList, setFurnitureList] = useState<Furniture[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const {
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FurnitureForm>({
    defaultValues: {
      furniture_name: "",
      categoryId: "",
      file: undefined,
    },
  });

  // Fetch furniture
  const loadFurniture = async () => {
    try {
      const data = await fetchFurniture();
      setFurnitureList(data);
    } catch (error) {
      console.error("Failed to load furniture:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to load furniture";
      showErrorToast(errorMessage);
    }
  };

  // Fetch categories
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
    loadFurniture();
    loadCategories();
  }, []);

  const onSubmit = async (data: FurnitureForm) => {
    setIsLoading(true);

    try {
      await uploadFurniture({
        furniture_name: data.furniture_name,
        categoryId: data.categoryId,
        file: data.file[0],
      });

      showSuccessToast("Furniture uploaded successfully");
      reset();
      await loadFurniture();
      setOpen(false);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Upload failed";
      showErrorToast(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this furniture?")) return;

    try {
      await deleteFurniture(id);
      showSuccessToast("Furniture deleted successfully");
      await loadFurniture();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Delete failed";
      showErrorToast(errorMessage);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow w-full flex flex-col h-[650px]">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Manage Furniture</h2>

        <Button variant="contained" onClick={() => setOpen(true)}>
          Add Furniture
        </Button>
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Add Furniture</DialogTitle>

        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent className="flex flex-col gap-4 mt-2">
            {/* Furniture Name */}
            <Controller
              name="furniture_name"
              control={control}
              rules={{ required: "Furniture name is required" }}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value || ""}
                  label="Furniture Name"
                  size="small"
                  error={!!errors.furniture_name}
                  helperText={errors.furniture_name?.message}
                  fullWidth
                />
              )}
            />

            {/* Category */}
            <Controller
              name="categoryId"
              control={control}
              rules={{ required: "Category is required" }}
              render={({ field }) => (
                <FormControl fullWidth size="small" error={!!errors.categoryId}>
                  <InputLabel>Category</InputLabel>
                  <Select {...field} value={field.value || ""} label="Category">
                    {categories.map((cat) => (
                      <MenuItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>{errors.categoryId?.message}</FormHelperText>
                </FormControl>
              )}
            />

            {/* File */}
            <Controller
              name="file"
              control={control}
              rules={{ required: "Image is required" }}
              render={({ field }) => (
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => field.onChange(e.target.files || null)}
                    className="border p-2 rounded w-full"
                  />
                  {errors.file && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.file.message}
                    </p>
                  )}
                </div>
              )}
            />
          </DialogContent>

          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancel</Button>

            <Button type="submit" variant="contained" disabled={isLoading}>
              {isLoading ? "Uploading..." : "Upload"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto">
        {furnitureList.length === 0 ? (
          <p className="p-4 text-gray-500 text-center">No furniture uploaded</p>
        ) : (
          furnitureList.map((item) => (
            <div
              key={item.id}
              className="flex flex-col p-3 rounded border hover:shadow-md transition bg-white"
            >
              {/* Image Container */}
              <div className="w-full h-48 overflow-hidden rounded">
                <img
                  src={item.url}
                  alt={item.furniture_name}
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Content */}
              <div className="flex justify-between items-center gap-3 mt-3">
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

                <button
                  onClick={() => handleDelete(item.id)}
                  className="text-red-600 bg-red-50 px-3 py-1 rounded hover:bg-red-100"
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
