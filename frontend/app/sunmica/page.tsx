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
import { useForm, Controller } from "react-hook-form";
import {
  fetchSunmicas,
  uploadSunmica,
  deleteSunmica,
  Sunmica,
} from "@/lib/api/sunmica";
import { showSuccessToast, showErrorToast } from "@/lib/toast";

interface SunmicaForm {
  name: string;
  file: FileList;
}

export default function SunmicaPage() {
  const [sunmicas, setSunmicas] = useState<Sunmica[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const {
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<SunmicaForm>({
    defaultValues: {
      name: "",
      file: undefined,
    },
  });

  const loadSunmicas = async () => {
    try {
      const data = await fetchSunmicas();
      setSunmicas(data);
    } catch (error) {
      console.error("Failed to load sunmicas:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to load sunmicas";
      showErrorToast(errorMessage);
    }
  };

  useEffect(() => {
    loadSunmicas();
  }, []);

  const onSubmit = async (data: SunmicaForm) => {
    setIsLoading(true);

    try {
      await uploadSunmica({
        name: data.name,
        file: data.file[0],
      });

      showSuccessToast("Sunmica uploaded successfully");
      reset();
      await loadSunmicas();
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
    if (!confirm("Delete this sunmica?")) return;

    try {
      await deleteSunmica(id);
      showSuccessToast("Sunmica deleted successfully");
      await loadSunmicas();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Delete failed";
      showErrorToast(errorMessage);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow w-full flex flex-col h-[650px]">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Manage Sunmica</h2>

        <Button variant="contained" onClick={() => setOpen(true)}>
          Add Sunmica
        </Button>
      </div>

      {/* Modal */}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Add Sunmica</DialogTitle>

        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent className="flex flex-col gap-4 mt-2">
            <Controller
              name="name"
              control={control}
              rules={{ required: "Name is required" }}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value || ""}
                  label="Sunmica Name"
                  size="small"
                  error={!!errors.name}
                  helperText={errors.name?.message}
                  fullWidth
                />
              )}
            />

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

      {/* Grid Layout (Same as Furniture) */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 overflow-y-auto">
        {sunmicas.length === 0 ? (
          <p className="p-4 text-gray-500 text-center">No sunmica uploaded</p>
        ) : (
          sunmicas.map((item) => (
            <div
              key={item.id}
              className="flex flex-col p-3 rounded border hover:shadow-md transition bg-white h-fit"
            >
              {/* Image */}
              <div className="w-full h-48 flex items-center justify-center bg-gray-100 rounded overflow-hidden">
                <img src={item.url} alt={item.name} className="w-full h-full" />
              </div>

              {/* Content */}
              <div className="flex justify-between items-center mt-3">
                <div className="font-medium">{item.name}</div>

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
