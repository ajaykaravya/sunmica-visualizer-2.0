"use client";

import { useState } from "react";
import { uploadFurniture } from "@/lib/api/furniture";
import { showSuccessToast, showErrorToast } from "@/lib/toast";

export default function AdminPage() {
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    try {
      await uploadFurniture({
        furniture_name: file.name.replace(/\.[^/.]+$/, ""), // Remove file extension
        categoryId: "default", // You can modify this as needed
        file: file,
      });

      showSuccessToast("Image uploaded successfully!");
      event.target.value = ""; // Reset file input
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to upload image";
      showErrorToast(errorMessage);
      console.error("Upload error:", error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8 flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-8">Admin Panel</h1>

      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Upload Panel */}
        <div className="bg-white p-6 rounded-lg shadow w-full text-center h-fit">
          <h2 className="text-xl font-semibold mb-4">
            Upload New Furniture Image
          </h2>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            disabled={isUploading}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 mb-4"
          />

          {isUploading && (
            <p className="text-blue-600 font-medium">Uploading...</p>
          )}
        </div>
      </div>
    </div>
  );
}
