"use client";

import { useRef, useState, useEffect } from "react";

interface FurnitureImageRecord {
  id: string;
  filename: string;
  url: string;
  categoryId: string;
  furniture_name: string;
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
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEmbedding, setIsEmbedding] = useState(false);
  const [selectedTextureId, setSelectedTextureId] = useState<string | null>(
    null,
  );
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

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

    // Reset Canvas and History
    setHistory([]);
    setHistoryIndex(-1);

    setIsEmbedding(true);

    const imgPromise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(new Error("Image load failed"));
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
        setImage(loadedImg); // Switches view exactly when both are strictly ready
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

    // Use naturalWidth/Height to prevent 0x0 collapse on headless Javascript images
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

    // Scale coordinates to original image size
    const scaleX = image.width / canvas.width;
    const scaleY = image.height / canvas.height;
    const origX = Math.floor(x * scaleX);
    const origY = Math.floor(y * scaleY);

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

      // Apply texture to mask
      const selectedTextureObj = availableSunmicaImages.find(
        (t) => t.id === selectedTextureId,
      );

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

    // Load the texture image
    const textureImg = new Image();
    textureImg.crossOrigin = "anonymous";
    textureImg.onload = () => {
      // Create a temporary canvas for the texture
      const textureCanvas = document.createElement("canvas");
      textureCanvas.width = canvas.width;
      textureCanvas.height = canvas.height;
      const textureCtx = textureCanvas.getContext("2d");
      if (!textureCtx) return;

      // Draw texture tiled across the canvas
      for (let x = 0; x < canvas.width; x += textureImg.width) {
        for (let y = 0; y < canvas.height; y += textureImg.height) {
          textureCtx.drawImage(textureImg, x, y);
        }
      }

      // Get texture image data
      const textureData = textureCtx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      );
      const texturePixels = textureData.data;

      // Get the current canvas image data
      const currentImageData = ctx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      );
      const currentPixels = currentImageData.data;

      // Apply texture only to masked regions
      for (let y = 0; y < mask.length; y++) {
        for (let x = 0; x < mask[y].length; x++) {
          if (mask[y][x]) {
            const index = (y * canvas.width + x) * 4;
            // Copy texture pixel to current image
            currentPixels[index] = texturePixels[index]; // R
            currentPixels[index + 1] = texturePixels[index + 1]; // G
            currentPixels[index + 2] = texturePixels[index + 2]; // B
            currentPixels[index + 3] = 255; // A (fully opaque)
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
    <div>
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-6xl mx-auto">
          {!image ? (
            <div className="bg-white p-6 rounded-lg shadow relative">
              {isEmbedding && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-lg">
                  <div className="text-4xl mb-4 animate-spin">⏳</div>
                  <h3 className="text-2xl font-bold text-gray-800">
                    Preparing AI Model
                  </h3>
                  <p className="text-gray-600 mt-2 text-lg font-medium">
                    Extracting furniture mapping features...
                  </p>
                  <p className="text-gray-500 mt-1">
                    (This one-time setup may take a few seconds)
                  </p>
                </div>
              )}
              <h2 className="text-xl font-semibold mb-4 border-b pb-2">
                Available Furniture Templates
              </h2>
              {availableFurnitureImages.length === 0 ? (
                <div className="text-center text-gray-500 py-12">
                  <p>No images available.</p>
                  <p className="text-sm mt-2">
                    Visit the Admin panel at{" "}
                    <a href="/admin" className="text-blue-500 underline">
                      /admin
                    </a>{" "}
                    to upload images first.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {availableFurnitureImages.map((img) => (
                    <div
                      key={img.id}
                      onClick={() => handleSelectImage(img)}
                      className="cursor-pointer border-2 border-transparent hover:border-blue-500 rounded-lg overflow-hidden transition-all shadow-sm group bg-white"
                    >
                      <div className="relative aspect-square sm:aspect-video bg-gray-50 flex items-center justify-center overflow-hidden">
                        <img
                          src={img.url}
                          alt="Furniture"
                          className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-transparent group-hover:bg-black/10 transition-all flex items-center justify-center">
                          <span className="text-white opacity-0 group-hover:opacity-100 font-medium bg-black/60 px-4 py-2 rounded shadow-sm backdrop-blur-sm">
                            Select
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="flex justify-between items-center mb-4">
                <button
                  onClick={() => {
                    setImage(null);
                    setActiveImageId(null);
                  }}
                  className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-2 transition-colors"
                >
                  ← Back to Gallery
                </button>
              </div>

              <div className="mb-6 p-4 bg-white rounded-lg shadow">
                <h2 className="text-lg font-semibold mb-3">
                  Select Sunmica Texture
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {availableSunmicaImages.map((texture) => (
                    <button
                      key={texture.id}
                      onClick={() => setSelectedTextureId(texture.id)}
                      disabled={isEmbedding}
                      className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center ${
                        isEmbedding ? "opacity-50 cursor-not-allowed " : ""
                      }${
                        selectedTextureId === texture.id
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 bg-gray-50 hover:border-gray-300"
                      }`}
                    >
                      <img
                        src={texture.url}
                        alt={texture.name}
                        className="w-full h-20 object-cover rounded-md mb-2 border"
                      />
                      <div className="text-xs font-medium text-center">
                        {texture.name}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative bg-white p-2 rounded-lg shadow flex justify-center">
                <canvas
                  ref={canvasRef}
                  onClick={!isEmbedding ? handleCanvasClick : undefined}
                  className={`border border-gray-300 max-w-full h-auto ${isEmbedding ? "cursor-wait opacity-70" : "cursor-crosshair"}`}
                  style={{
                    display: image ? "block" : "none",
                    maxHeight: "70vh",
                  }}
                />
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg backdrop-blur-sm">
                    <div className="text-white text-center flex flex-col items-center">
                      <div className="text-4xl mb-3 animate-spin">⌛</div>
                      <div className="text-xl font-bold">
                        Applying Texture...
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-center gap-4 mt-6">
                <button
                  onClick={handleUndo}
                  disabled={historyIndex <= 0 || isEmbedding || isLoading}
                  className={`px-6 py-2 rounded-lg font-medium transition-all shadow-sm flex items-center gap-2 ${
                    historyIndex <= 0 || isEmbedding || isLoading
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                      : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 hover:shadow"
                  }`}
                >
                  <span>↩️</span> Undo
                </button>
                <button
                  onClick={handleRefresh}
                  disabled={historyIndex <= 0 || isEmbedding || isLoading}
                  className={`px-6 py-2 rounded-lg font-medium transition-all shadow-sm flex items-center gap-2 ${
                    historyIndex <= 0 || isEmbedding || isLoading
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                      : "bg-white text-red-600 hover:bg-red-50 border border-red-200 hover:shadow"
                  }`}
                >
                  <span>🔄</span> Reset
                </button>
                <button
                  onClick={handleRedo}
                  disabled={
                    historyIndex >= history.length - 1 ||
                    isEmbedding ||
                    isLoading
                  }
                  className={`px-6 py-2 rounded-lg font-medium transition-all shadow-sm flex items-center gap-2 ${
                    historyIndex >= history.length - 1 ||
                    isEmbedding ||
                    isLoading
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                      : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 hover:shadow"
                  }`}
                >
                  Redo <span>↪️</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
