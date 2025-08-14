import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, X, File, Image, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FileUploadProps {
  onUpload: (files: UploadedFile[]) => void;
  maxFiles?: number;
  maxSize?: number; // in MB
  accept?: string;
  className?: string;
  "data-testid"?: string;
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
}

export function FileUpload({ 
  onUpload, 
  maxFiles = 5, 
  maxSize = 10, 
  accept = "image/*,application/pdf",
  className = "",
  "data-testid": testId
}: FileUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return Image;
    if (type === 'application/pdf') return FileText;
    return File;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const validateFile = (file: File): string | null => {
    // Size check
    if (file.size > maxSize * 1024 * 1024) {
      return `File size exceeds ${maxSize}MB limit`;
    }

    // Type check
    if (accept) {
      const acceptedTypes = accept.split(',').map(type => type.trim());
      const fileType = file.type;
      const fileName = file.name.toLowerCase();
      
      const isAccepted = acceptedTypes.some(acceptType => {
        if (acceptType.startsWith('.')) {
          return fileName.endsWith(acceptType);
        }
        if (acceptType.includes('*')) {
          const baseType = acceptType.replace('*', '');
          return fileType.startsWith(baseType);
        }
        return fileType === acceptType;
      });

      if (!isAccepted) {
        return `File type not supported. Accepted: ${accept}`;
      }
    }

    return null;
  };

  const processFiles = async (fileList: FileList) => {
    if (files.length + fileList.length > maxFiles) {
      toast({
        title: "Too many files",
        description: `Maximum ${maxFiles} files allowed`,
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    const newFiles: UploadedFile[] = [];

    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const error = validateFile(file);
        
        if (error) {
          toast({
            title: "File validation error",
            description: `${file.name}: ${error}`,
            variant: "destructive",
          });
          continue;
        }

        // Simulate file processing (crop/deskew stub)
        await new Promise(resolve => setTimeout(resolve, 500));

        // Create file object
        const uploadedFile: UploadedFile = {
          id: `file_${Date.now()}_${i}`,
          name: file.name,
          size: file.size,
          type: file.type,
          url: URL.createObjectURL(file), // For preview purposes
        };

        newFiles.push(uploadedFile);
      }

      const updatedFiles = [...files, ...newFiles];
      setFiles(updatedFiles);
      onUpload(newFiles);

      if (newFiles.length > 0) {
        toast({
          title: "Files uploaded successfully",
          description: `${newFiles.length} file(s) processed`,
        });
      }
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "An error occurred while processing files",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (fileId: string) => {
    const updatedFiles = files.filter(file => file.id !== fileId);
    setFiles(updatedFiles);
    
    // Find the removed file and revoke its URL to prevent memory leaks
    const removedFile = files.find(file => file.id === fileId);
    if (removedFile?.url) {
      URL.revokeObjectURL(removedFile.url);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      processFiles(droppedFiles);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      processFiles(selectedFiles);
    }
    // Reset input value to allow re-selecting the same file
    e.target.value = '';
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Upload Area */}
      <Card 
        className={`border-2 border-dashed transition-colors ${
          dragOver 
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <CardContent className="p-8">
          <div className="text-center space-y-4">
            <div className={`mx-auto w-12 h-12 ${dragOver ? 'text-blue-500' : 'text-gray-400'}`}>
              <Upload className="w-full h-full" />
            </div>
            
            <div>
              <p className="text-lg font-medium">
                {uploading ? 'Processing files...' : 'Drop files here or click to browse'}
              </p>
              <p className="text-sm text-muted-foreground">
                {accept.includes('image') && accept.includes('pdf') 
                  ? 'Supports images and PDF files'
                  : accept.includes('image') 
                    ? 'Supports image files'
                    : 'Supports PDF files'
                } (max {maxSize}MB each, {maxFiles} files total)
              </p>
            </div>
            
            <Button 
              onClick={handleFileSelect} 
              disabled={uploading || files.length >= maxFiles}
              data-testid={testId ? `${testId}-button` : "button-select-files"}
            >
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                'Select Files'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
        data-testid={testId ? `${testId}-input` : "input-file"}
      />

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-medium text-sm">Uploaded Files:</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {files.map((file) => {
              const FileIcon = getFileIcon(file.type);
              return (
                <div 
                  key={file.id} 
                  className="flex items-center justify-between p-3 border rounded-lg bg-card"
                  data-testid={`uploaded-file-${file.id}`}
                >
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <FileIcon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate" title={file.name}>
                        {file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(file.id)}
                    className="text-red-500 hover:text-red-700 flex-shrink-0"
                    data-testid={`button-remove-${file.id}`}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {files.length >= maxFiles && (
        <p className="text-xs text-amber-600">
          Maximum number of files reached ({maxFiles})
        </p>
      )}
    </div>
  );
}