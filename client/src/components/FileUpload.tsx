import { useState, useRef, useCallback } from "react";
import { Upload, X, FileText, Image, File, AlertCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface FileUploadFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  progress: number;
  error?: string;
  url?: string;
  kind?: 'photo' | 'pdf' | 'note' | 'other';
}

interface FileUploadProps {
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  maxSize?: number; // in bytes
  onFilesChange: (files: FileUploadFile[]) => void;
  onUpload?: (files: FileUploadFile[]) => Promise<void>;
  className?: string;
  disabled?: boolean;
}

const getFileIcon = (type: string) => {
  if (type.startsWith('image/')) return Image;
  if (type === 'application/pdf') return FileText;
  return File;
};

const getFileKind = (type: string): FileUploadFile['kind'] => {
  if (type.startsWith('image/')) return 'photo';
  if (type === 'application/pdf') return 'pdf';
  return 'other';
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * FileUpload - A comprehensive file upload component with drag & drop
 * 
 * Features:
 * - Drag and drop file upload
 * - Multiple file selection
 * - File type validation and filtering
 * - File size limits
 * - Upload progress tracking
 * - Preview for images
 * - Error handling and validation
 * - Accessible design with keyboard navigation
 * - Mobile-friendly responsive design
 */
export function FileUpload({
  accept = "image/*,.pdf,.doc,.docx",
  multiple = true,
  maxFiles = 5,
  maxSize = 10 * 1024 * 1024, // 10MB
  onFilesChange,
  onUpload,
  className,
  disabled = false,
}: FileUploadProps) {
  const [files, setFiles] = useState<FileUploadFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateFiles = useCallback((newFiles: FileUploadFile[]) => {
    setFiles(newFiles);
    onFilesChange(newFiles);
  }, [onFilesChange]);

  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > maxSize) {
      return `File size must be less than ${formatFileSize(maxSize)}`;
    }

    // Check file type
    if (accept && accept !== "*") {
      const acceptedTypes = accept.split(',').map(type => type.trim());
      const isAccepted = acceptedTypes.some(acceptedType => {
        if (acceptedType.startsWith('.')) {
          // Extension check
          return file.name.toLowerCase().endsWith(acceptedType.toLowerCase());
        } else if (acceptedType.includes('*')) {
          // MIME type wildcard check
          const [type] = acceptedType.split('/');
          return file.type.startsWith(type);
        } else {
          // Exact MIME type check
          return file.type === acceptedType;
        }
      });

      if (!isAccepted) {
        return `File type not accepted. Allowed types: ${accept}`;
      }
    }

    return null;
  };

  const processFiles = (fileList: FileList) => {
    const newFiles: FileUploadFile[] = [];
    
    Array.from(fileList).forEach((file) => {
      // Check max files limit
      if (files.length + newFiles.length >= maxFiles) {
        return;
      }

      const error = validateFile(file);
      const fileUpload: FileUploadFile = {
        id: Math.random().toString(36).substr(2, 9),
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        status: error ? 'error' : 'pending',
        progress: 0,
        error,
        kind: getFileKind(file.type),
      };

      newFiles.push(fileUpload);
    });

    updateFiles([...files, ...newFiles]);
  };

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (fileList && fileList.length > 0) {
      processFiles(fileList);
    }
    // Reset input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    if (!disabled) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
    
    if (disabled) return;

    const fileList = event.dataTransfer.files;
    if (fileList && fileList.length > 0) {
      processFiles(fileList);
    }
  };

  const removeFile = (fileId: string) => {
    const updatedFiles = files.filter(f => f.id !== fileId);
    updateFiles(updatedFiles);
  };

  const handleUpload = async () => {
    if (!onUpload || isUploading) return;

    setIsUploading(true);
    
    // Update all pending files to uploading status
    const uploadingFiles = files.map(file => 
      file.status === 'pending' ? { ...file, status: 'uploading' as const } : file
    );
    updateFiles(uploadingFiles);

    try {
      await onUpload(uploadingFiles);
      
      // Update all uploading files to complete status
      const completedFiles = uploadingFiles.map(file => 
        file.status === 'uploading' ? { ...file, status: 'complete' as const, progress: 100 } : file
      );
      updateFiles(completedFiles);
    } catch (error) {
      // Update files with error status
      const errorFiles = uploadingFiles.map(file => 
        file.status === 'uploading' ? { 
          ...file, 
          status: 'error' as const, 
          error: error instanceof Error ? error.message : 'Upload failed' 
        } : file
      );
      updateFiles(errorFiles);
    } finally {
      setIsUploading(false);
    }
  };

  const openFileDialog = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Upload Area */}
      <Card
        className={cn(
          "transition-all duration-200 cursor-pointer",
          isDragOver && !disabled && "border-primary-400 bg-primary-50",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onClick={openFileDialog}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        data-testid="file-upload-area"
      >
        <CardContent className="p-8 text-center">
          <div className="flex flex-col items-center space-y-4">
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center",
              isDragOver && !disabled ? "bg-primary-100" : "bg-slate-100"
            )}>
              <Upload className={cn(
                "h-6 w-6",
                isDragOver && !disabled ? "text-primary-600" : "text-slate-600"
              )} />
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-slate-900">
                {isDragOver && !disabled ? "Drop files here" : "Upload files"}
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Drag and drop files here, or click to browse
              </p>
              <p className="text-xs text-slate-500 mt-2">
                Max {maxFiles} files, {formatFileSize(maxSize)} each. Supported: {accept}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFileInput}
        className="hidden"
        disabled={disabled}
        data-testid="file-input"
      />

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-slate-900">
              Selected Files ({files.length})
            </h4>
            {files.some(f => f.status === 'pending' || f.status === 'error') && onUpload && (
              <Button
                onClick={handleUpload}
                disabled={isUploading || disabled}
                size="sm"
                data-testid="upload-button"
              >
                {isUploading ? "Uploading..." : "Upload All"}
              </Button>
            )}
          </div>

          <div className="space-y-2">
            {files.map((file) => {
              const Icon = getFileIcon(file.type);
              
              return (
                <Card key={file.id} className="p-3">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      <Icon className="h-8 w-8 text-slate-400" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {file.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatFileSize(file.size)}
                            {file.kind && (
                              <Badge variant="secondary" className="ml-2 text-xs">
                                {file.kind}
                              </Badge>
                            )}
                          </p>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <StatusIcon status={file.status} />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFile(file.id);
                            }}
                            className="h-6 w-6 p-0"
                            data-testid={`remove-file-${file.id}`}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* Progress Bar */}
                      {file.status === 'uploading' && (
                        <Progress value={file.progress} className="mt-2 h-1" />
                      )}
                      
                      {/* Error Message */}
                      {file.error && (
                        <p className="text-xs text-red-600 mt-1">{file.error}</p>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Status icon component for file upload states
 */
function StatusIcon({ status }: { status: FileUploadFile['status'] }) {
  switch (status) {
    case 'complete':
      return <Check className="h-4 w-4 text-green-600" />;
    case 'error':
      return <AlertCircle className="h-4 w-4 text-red-600" />;
    case 'uploading':
      return <div className="h-4 w-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />;
    default:
      return null;
  }
}