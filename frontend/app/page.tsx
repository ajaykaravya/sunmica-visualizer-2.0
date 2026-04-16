"use client";
/* eslint-disable @next/next/no-img-element */

import { useRef, useState, useEffect, useMemo } from "react";

interface FurnitureImageRecord {
  id: string;
  filename: string;
  url: string;
  categoryId: string;
  furniture_name: string;
  category_name?: string;
}

interface SunmicaImageRecord {
  id: string;
  name: string;
  filename: string;
  url: string;
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [availableFurnitureImages, setAvailableFurnitureImages] = useState<
    FurnitureImageRecord[]
  >([]);
  const [availableSunmicaImages, setAvailableSunmicaImages] = useState<
    SunmicaImageRecord[]
  >([]);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const [selectedCategoryName, setSelectedCategoryName] = useState<
    string | null
  >(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEmbedding, setIsEmbedding] = useState(false);
  const [selectedTextureId, setSelectedTextureId] = useState<string | null>(
    null,
  );
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  const furnitureByCategory = useMemo(() => {
    const groups = new Map<string, FurnitureImageRecord[]>();
    availableFurnitureImages.forEach((item) => {
      const category = item.category_name?.trim() || "Uncategorized";
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category)!.push(item);
    });
    return groups;
  }, [availableFurnitureImages]);

  const categoryNames = useMemo(
    () => Array.from(furnitureByCategory.keys()),
    [furnitureByCategory],
  );

  useEffect(() => {
    if (!selectedCategoryName && categoryNames.length > 0) {
      setSelectedCategoryName(categoryNames[0]);
    }
  }, [categoryNames, selectedCategoryName]);

  const selectedFurnitureRecords = selectedCategoryName
    ? (furnitureByCategory.get(selectedCategoryName) ?? [])
    : availableFurnitureImages;

  const selectedTextureObj = availableSunmicaImages.find(
    (texture) => texture.id === selectedTextureId,
  );

  const selectedFurniture = availableFurnitureImages.find(
    (item) => item.id === activeImageId,
  );

  // Load available images on mount
  useEffect(() => {
    fetch("http://127.0.0.1:8000/furniture/images")
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "success") {
          setAvailableFurnitureImages(data.images);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/sunmica/images")
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "success") {
          setAvailableSunmicaImages(data.images);
        }
      })
      .catch(console.error);
  }, []);

  // Synchronize canvas painting safely AFTER the DOM has actually mounted the canvas element
  useEffect(() => {
    if (image) {
      drawImage(image);
    }
  }, [image]);

  const handleSelectImage = (record: FurnitureImageRecord) => {
    setActiveImageId(record.id);
    setHistory([]);
    setHistoryIndex(-1);
    setIsEmbedding(true);

    const imgPromise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Image load failed"));
      img.src = record.url + "?t=" + new Date().getTime();
    });

    const formData = new FormData();
    formData.append("image_id", record.id);
    const embedPromise = fetch("http://127.0.0.1:8000/embed", {
      method: "POST",
      body: formData,
    }).then((res) => {
      if (!res.ok) throw new Error("Embed failed");
      return res.json();
    });

    Promise.all([imgPromise, embedPromise])
      .then(([loadedImg]) => {
        setImage(loadedImg);
        setIsEmbedding(false);
      })
      .catch((err) => {
        console.error(err);
        alert("Failed to load image securely or extract AI features.");
        setIsEmbedding(false);
        setActiveImageId(null);
      });
  };

  const drawImage = (img: HTMLImageElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = img.naturalWidth || img.width || 1024;
    canvas.height = img.naturalHeight || img.height || 1024;
    ctx.drawImage(img, 0, 0);

    const initialData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory([initialData]);
    setHistoryIndex(0);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (ctx && canvas) {
        ctx.putImageData(history[newIndex], 0, 0);
      }
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (ctx && canvas) {
        ctx.putImageData(history[newIndex], 0, 0);
      }
    }
  };

  const handleRefresh = () => {
    if (historyIndex > 0) {
      setHistoryIndex(0);
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (ctx && canvas) {
        ctx.putImageData(history[0], 0, 0);
      }
    }
  };

  const handleCanvasClick = async (
    event: React.MouseEvent<HTMLCanvasElement>,
  ) => {
    if (!image || !canvasRef.current || !activeImageId) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const scaleX = image.naturalWidth / rect.width;
    const scaleY = image.naturalHeight / rect.height;

    const origX = Math.floor((event.clientX - rect.left) * scaleX);
    const origY = Math.floor((event.clientY - rect.top) * scaleY);

    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("image_id", activeImageId);
      formData.append("x", origX.toString());
      formData.append("y", origY.toString());

      const response = await fetch("http://127.0.0.1:8000/segment", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to get mask");
      }

      const data = await response.json();
      const mask = data.mask;
      const selectedTexturePath = selectedTextureObj?.url;
      if (selectedTexturePath) {
        applyTexture(mask, selectedTexturePath);
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Failed to process click. Make sure backend is running.");
    } finally {
      setIsLoading(false);
    }
  };

  const applyTexture = (mask: number[][], texturePath: string) => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const textureImg = new Image();
    textureImg.crossOrigin = "anonymous";
    textureImg.onload = () => {
      const textureCanvas = document.createElement("canvas");
      textureCanvas.width = canvas.width;
      textureCanvas.height = canvas.height;
      const textureCtx = textureCanvas.getContext("2d");
      if (!textureCtx) return;

      for (let x = 0; x < canvas.width; x += textureImg.width) {
        for (let y = 0; y < canvas.height; y += textureImg.height) {
          textureCtx.drawImage(textureImg, x, y);
        }
      }

      const textureData = textureCtx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      );
      const texturePixels = textureData.data;

      const currentImageData = ctx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      );
      const currentPixels = currentImageData.data;

      const maskHeight = mask.length;
      const maskWidth = mask[0].length;

      const scaleX = canvas.width / maskWidth;
      const scaleY = canvas.height / maskHeight;

      for (let y = 0; y < maskHeight; y++) {
        for (let x = 0; x < maskWidth; x++) {
          if (mask[y][x]) {
            const canvasX = Math.floor(x * scaleX);
            const canvasY = Math.floor(y * scaleY);

            const index = (canvasY * canvas.width + canvasX) * 4;

            currentPixels[index] = texturePixels[index];
            currentPixels[index + 1] = texturePixels[index + 1];
            currentPixels[index + 2] = texturePixels[index + 2];
            currentPixels[index + 3] = 255;
          }
        }
      }

      ctx.putImageData(currentImageData, 0, 0);
      const savedData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setHistoryIndex((prevIdx) => {
        setHistory((prevHist) => {
          const newHist = prevHist.slice(0, prevIdx + 1);
          return [...newHist, savedData];
        });
        return prevIdx + 1;
      });
    };

    textureImg.src = texturePath;
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-[1400px] mx-auto grid gap-6 lg:grid-cols-12">
        <aside className="lg:col-span-3 space-y-4">
          <div className="bg-white rounded-xl shadow p-5">
            <h2 className="text-xl font-semibold mb-4">Furniture Library</h2>
            <div className="flex flex-wrap gap-2 mb-4">
              {categoryNames.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategoryName(category)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-all border ${
                    selectedCategoryName === category
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            {selectedFurnitureRecords.length === 0 ? (
              <div className="text-center text-gray-500 py-10">
                No furniture available in this category.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {selectedFurnitureRecords.map((img) => (
                  <button
                    key={img.id}
                    onClick={() => handleSelectImage(img)}
                    className={`group rounded-xl overflow-hidden border transition-all text-left ${
                      activeImageId === img.id
                        ? "border-blue-500 shadow-sm"
                        : "border-gray-200 hover:border-blue-400"
                    }`}
                  >
                    <div className="relative aspect-square bg-gray-50 flex items-center justify-center overflow-hidden">
                      <img
                        src={img.url}
                        alt={img.furniture_name}
                        className="w-full h-full object-contain p-2"
                      />
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-medium text-gray-800">
                        {img.furniture_name}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        <main className="lg:col-span-6 space-y-4">
          <div className="bg-white rounded-xl shadow p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold">Preview</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {selectedFurniture?.furniture_name ||
                    "Select furniture from the left to load the preview."}
                </p>
              </div>
              {activeImageId && (
                <button
                  onClick={() => {
                    setImage(null);
                    setActiveImageId(null);
                  }}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  Clear selection
                </button>
              )}
            </div>

            <div className="flex justify-center items-center relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-50 min-h-[420px]">
              {!image && (
                <div className="h-full flex flex-col items-center justify-center text-center px-6 py-12">
                  <div className="text-3xl mb-3">🖼️</div>
                  <p className="text-lg font-semibold mb-2">
                    No furniture selected
                  </p>
                  <p className="text-sm text-gray-500">
                    Pick a category and tap a furniture template on the left.
                  </p>
                </div>
              )}

              {image && (
                <canvas
                  ref={canvasRef}
                  onClick={!isEmbedding ? handleCanvasClick : undefined}
                  className={` max-w-full h-auto ${isEmbedding ? "cursor-wait opacity-70" : "cursor-crosshair"}`}
                  style={{
                    display: image ? "block" : "none",
                    maxHeight: "70vh",
                  }}
                />
              )}

              {(isEmbedding || isLoading) && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center">
                  <div className="text-4xl mb-3 animate-spin">⌛</div>
                  <div className="text-lg font-semibold text-gray-800">
                    {isEmbedding
                      ? "Preparing AI model..."
                      : "Applying texture..."}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-5">
            <h2 className="text-xl font-semibold mb-4">Edit Actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={handleUndo}
                disabled={historyIndex <= 0 || isEmbedding || isLoading}
                className={`w-full rounded-xl px-4 py-3 font-medium transition-all border ${
                  historyIndex <= 0 || isEmbedding || isLoading
                    ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                ↩️ Undo
              </button>
              <button
                onClick={handleRefresh}
                disabled={historyIndex <= 0 || isEmbedding || isLoading}
                className={`w-full rounded-xl px-4 py-3 font-medium transition-all border ${
                  historyIndex <= 0 || isEmbedding || isLoading
                    ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                    : "bg-white text-red-600 border-red-200 hover:bg-red-50"
                }`}
              >
                🔄 Reset
              </button>
              <button
                onClick={handleRedo}
                disabled={
                  historyIndex >= history.length - 1 || isEmbedding || isLoading
                }
                className={`w-full rounded-xl px-4 py-3 font-medium transition-all border ${
                  historyIndex >= history.length - 1 || isEmbedding || isLoading
                    ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                Redo ↪️
              </button>
            </div>
          </div>
        </main>

        <aside className="lg:col-span-3 space-y-4">
          <div className="bg-white rounded-xl shadow p-5">
            <h2 className="text-xl font-semibold mb-4">Available Sunmica</h2>
            {selectedTextureObj ? (
              <div className="mb-4 rounded-2xl overflow-hidden border border-gray-200">
                <img
                  src={selectedTextureObj.url}
                  alt={selectedTextureObj.name}
                  className="w-full h-40 object-cover"
                />
                <div className="p-4 bg-gray-50">
                  <p className="text-sm font-medium text-gray-900">
                    {selectedTextureObj.name}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mb-4 rounded-2xl border border-dashed border-gray-300 py-8 px-4 text-center text-sm text-gray-500">
                Select a texture to preview here.
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {availableSunmicaImages.map((texture) => (
                <button
                  key={texture.id}
                  onClick={() => setSelectedTextureId(texture.id)}
                  disabled={isEmbedding}
                  className={`group rounded-2xl overflow-hidden border transition-all ${
                    selectedTextureId === texture.id
                      ? "border-blue-500 shadow-sm"
                      : "border-gray-200 hover:border-blue-400"
                  } ${isEmbedding ? "opacity-50 cursor-not-allowed" : "bg-white"}`}
                >
                  <img
                    src={texture.url}
                    alt={texture.name}
                    className="w-full h-24 object-cover"
                  />
                  <div className="p-3 text-xs font-medium text-gray-700 text-center">
                    {texture.name}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
