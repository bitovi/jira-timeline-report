import type { Dispatch, FC, SetStateAction } from "react";

import React, { useId, useState } from "react";
import { Label } from "@atlaskit/form";

interface ImageDropzoneProps {
  name?: string;
  files: File[];
  setFiles: Dispatch<SetStateAction<File[]>>;
}

const ImageDropzone: FC<ImageDropzoneProps> = ({ name = "images", files, setFiles }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileId = useId();

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(event.dataTransfer.files);
    setFiles((prev) => [...prev, ...droppedFiles]);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    setFiles((prev) => [...prev, ...selectedFiles]);
  };

  return (
    <div className="pt-4">
      {files.length > 0 && (
        <ul className="mt-4 space-y-2">
          {files.map((file, i) => (
            <li key={file.name} className="flex justify-between">
              <div className="flex items-center gap-4 ">
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  className="w-8 h-8 object-cover rounded border"
                />
                <div>
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-gray-500">{Math.round(file.size / 1024)} KB</p>
                </div>
              </div>
              <button
                className="text-blue-600 hover:underline"
                onClick={() => setFiles((prev) => prev.filter(({ name }) => name !== file.name))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <div
        className={`border border-dashed rounded mt-4 p-6 text-center  ${
          isDragging ? "border-blue-400 bg-blue-50" : "border-gray-300"
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          id={fileId}
          name={name}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
        <Label htmlFor={fileId}>
          <p className="text-blue-600 underline cursor-pointer">
            {isDragging ? "Drop files here" : "Drag and drop files or click to upload"}
          </p>
          <p className="text-sm text-gray-400">Images only</p>
        </Label>
      </div>
    </div>
  );
};

export default ImageDropzone;
