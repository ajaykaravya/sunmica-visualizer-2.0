"use client";

import { useEffect, useState } from "react";

interface Sunmica {
  id: string;
  name: string;
  filename: string;
  url: string;
}

export default function SunmicaPage() {
  const [sunmicas, setSunmicas] = useState<Sunmica[]>([]);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchSunmicas = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/sunmica/images");
      const data = await res.json();
      if (data.status === "success") {
        setSunmicas(data.images);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSunmicas();
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!file) {
      setErrorMsg("Please select a file");
      return;
    }

    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", name);

      const res = await fetch("http://127.0.0.1:8000/sunmica/upload", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();

      if (!res.ok) {
        setErrorMsg(result.detail || "Upload failed");
      } else {
        setName("");
        setFile(null);
        await fetchSunmicas();
      }
    } catch (err) {
      setErrorMsg("Upload failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this sunmica?")) return;

    try {
      const res = await fetch(`http://127.0.0.1:8000/sunmica/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchSunmicas();
      } else {
        const data = await res.json();
        alert(data.detail || "Delete failed");
      }
    } catch {
      alert("Error deleting");
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow w-full flex flex-col h-[600px]">
      <h2 className="text-xl font-semibold mb-4">Manage Sunmica</h2>

      {errorMsg && (
        <div className="mb-4 text-red-600 bg-red-50 p-2 rounded">
          {errorMsg}
        </div>
      )}

      {/* Upload Form */}
      <form onSubmit={handleUpload} className="flex flex-col gap-3 mb-6">
        <input
          type="text"
          placeholder="Sunmica Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border p-2 rounded"
        />

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
          {isLoading ? "Uploading..." : "Upload Sunmica"}
        </button>
      </form>

      {/* List */}
      <div className="flex-1 overflow-y-auto border rounded divide-y">
        {sunmicas.length === 0 ? (
          <p className="p-4 text-gray-500 text-center">No sunmica uploaded</p>
        ) : (
          sunmicas.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-3 hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <img
                  src={item.url}
                  alt={item.name}
                  className="w-16 h-16 object-cover rounded border"
                />
                <span className="font-medium">{item.name}</span>
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
