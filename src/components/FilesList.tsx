"use client";
import { useState, useEffect } from "react";
import { FilePdf, FileText } from "@phosphor-icons/react";
import { apiGetUserFiles } from "@/lib/client";

interface FileData {
  id: string;
  filename: string;
  fileSize: number;
  displaySize: string;
  displayDate: string;
  createdAt: string;
}

interface FilesListProps {
  onAddFileToChat: (filename: string, fileId: string) => void;
}

export default function FilesList({ onAddFileToChat }: FilesListProps) {
  const [files, setFiles] = useState<FileData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      setLoading(true);
      const response = await apiGetUserFiles();
      setFiles(response.files || []);
      setError(null);
    } catch (err) {
      console.error('Failed to load files:', err);
      setError('Failed to load files');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-[1000px] mx-auto w-full h-full">
        <div className="panel rounded-[14px] card-shadow h-full flex flex-col">
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#d9d9d9]">
              <FileText size={18} /> 
              <span className="font-mono-ui">Your files</span>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-[#9a9a9a] font-mono-ui">Loading files...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-[1000px] mx-auto w-full h-full">
        <div className="panel rounded-[14px] card-shadow h-full flex flex-col">
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#d9d9d9]">
              <FileText size={18} /> 
              <span className="font-mono-ui">Your files</span>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-red-400 font-mono-ui">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="max-w-[1000px] mx-auto w-full h-full">
        <div className="panel rounded-[14px] card-shadow h-full flex flex-col">
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#d9d9d9]">
              <FileText size={18} /> 
              <span className="font-mono-ui">Your files</span>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <FilePdf size={48} className="mx-auto mb-4 text-[#5a5a5a]" />
              <div className="text-[#9a9a9a] font-mono-ui mb-2">No files uploaded yet</div>
              <div className="text-[#6a6a6a] font-mono-ui text-sm">Files will appear here after you run comparisons</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1000px] mx-auto w-full h-full">
      <div className="panel rounded-[14px] card-shadow h-full flex flex-col">
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#d9d9d9]">
            <FileText size={18} /> 
            <span className="font-mono-ui">Your files ({files.length})</span>
          </div>
          <button 
            onClick={loadFiles}
            className="text-[#9a9a9a] hover:text-[#d9d9d9] font-mono-ui text-sm transition-colors"
          >
            Refresh
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {files.map((file) => (
            <div key={file.id} className="rounded-[12px] panel p-3 flex items-center gap-3 hover:bg-[#1a1a1a] transition-colors">
              <FilePdf size={18} className="text-[#d9d9d9]" />
              <div className="flex-1">
                <div className="text-[#d9d9d9] font-mono-ui">{file.filename}</div>
                <div className="text-[#9a9a9a] text-xs">
                  {file.displaySize} • {file.displayDate}
                </div>
              </div>
              <button 
                onClick={() => onAddFileToChat(file.filename, file.id)}
                className="h-8 w-8 rounded-full bg-[#0f0f0f] border border-[#2a2a2a] hover:bg-[#1a1a1a] hover:border-[#3a3a3a] transition-colors flex items-center justify-center"
                title={`Add ${file.filename} to chat`}
              >
                <span className="text-[#d9d9d9] text-base">+</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}