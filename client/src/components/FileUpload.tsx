import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { 
  Upload, 
  File, 
  Image, 
  X, 
  Check, 
  AlertTriangle, 
  Download,
  Eye,
  Paperclip
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  claimId?: string;
  preAuthId?: string;
  maxFiles?: number;
  maxFileSize?: number; // in bytes
  acceptedTypes?: string[];
  onUploadComplete?: (files: UploadedFile[]) => void;
  className?: string;
  disabled?: boolean;
  compact?: boolean;
}

interface UploadedFile {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  url: string;
  uploadedAt: string;
  uploadedBy: string;
}

interface FileWithPreview extends File {
  id: string;
  preview?: string;
  uploadProgress?: number;
  uploadStatus?: 'pending' | 'uploading' | 'success' | 'error';
  errorMessage?: string;
}

const ACCEPTED_FILE_TYPES = {
  'application/pdf': { icon: File, label: 'PDF Document' },
  'image/jpeg': { icon: Image, label: 'JPEG Image' },
  'image/jpg': { icon: Image, label: 'JPG Image' },
  'image/png': { icon: Image, label: 'PNG Image' },
  'image/tiff': { icon: Image, label: 'TIFF Image' },
  'text/plain': { icon: File, label: 'Text Document' },
  'application/msword': { icon: File, label: 'Word Document' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { icon: File, label: 'Word Document' },
};

export function FileUpload({
  claimId,
  preAuthId,
  maxFiles = 10,
  maxFileSize = 10 * 1024 * 1024, // 10MB
  acceptedTypes = Object.keys(ACCEPTED_FILE_TYPES),
  onUploadComplete,
  className,
  disabled = false,
  compact = false
}: FileUploadProps) {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: FileWithPreview) => {
      const formData = new FormData();
      formData.append('file', file);
      if (claimId) formData.append('claimId', claimId);
      if (preAuthId) formData.append('preAuthId', preAuthId);

      return apiRequest('/api/files/upload', {
        method: 'POST',
        body: formData,
      });
    },
    onSuccess: (data, file) => {
      setFiles(prev => prev.map(f => 
        f.id === file.id 
          ? { ...f, uploadStatus: 'success', uploadProgress: 100 }
          : f
      ));
      
      // Invalidate related queries
      if (claimId) {
        queryClient.invalidateQueries({ queryKey: ['/api/claims', claimId, 'files'] });
      }
      if (preAuthId) {
        queryClient.invalidateQueries({ queryKey: ['/api/preauths', preAuthId, 'files'] });
      }

      toast({
        title: "Upload successful",
        description: `${file.name} has been uploaded successfully.`,
      });
    },
    onError: (error, file) => {
      setFiles(prev => prev.map(f => 
        f.id === file.id 
          ? { ...f, uploadStatus: 'error', errorMessage: error.message }
          : f
      ));

      toast({
        title: "Upload failed",
        description: `Failed to upload ${file.name}: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const validateFile = (file: File): string | null => {
    if (file.size > maxFileSize) {
      return `File size must be less than ${formatFileSize(maxFileSize)}`;
    }

    if (!acceptedTypes.includes(file.type)) {
      return `File type ${file.type} is not supported`;
    }

    return null;
  };

  const addFiles = useCallback((newFiles: File[]) => {
    const validFiles: FileWithPreview[] = [];
    const errors: string[] = [];

    newFiles.forEach(file => {
      const error = validateFile(file);
      if (error) {
        errors.push(`${file.name}: ${error}`);
        return;
      }

      if (files.length + validFiles.length >= maxFiles) {
        errors.push(`Maximum ${maxFiles} files allowed`);
        return;
      }

      const fileWithPreview: FileWithPreview = Object.assign(file, {
        id: `${Date.now()}-${file.name}`,
        uploadStatus: 'pending' as const,
        uploadProgress: 0,
      });

      // Create preview for images
      if (file.type.startsWith('image/')) {
        fileWithPreview.preview = URL.createObjectURL(file);
      }

      validFiles.push(fileWithPreview);
    });

    if (errors.length > 0) {
      toast({
        title: "Some files could not be added",
        description: errors.join('. '),
        variant: "destructive",
      });
    }

    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles]);
      
      // Start uploading files immediately
      validFiles.forEach(file => {
        setFiles(prev => prev.map(f => 
          f.id === file.id 
            ? { ...f, uploadStatus: 'uploading' }
            : f
        ));
        uploadMutation.mutate(file);
      });
    }
  }, [files.length, maxFiles, maxFileSize, acceptedTypes, toast, uploadMutation]);

  const removeFile = (fileId: string) => {
    setFiles(prev => {
      const file = prev.find(f => f.id === fileId);
      if (file?.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter(f => f.id !== fileId);
    });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    addFiles(selectedFiles);
    // Reset input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
    
    const droppedFiles = Array.from(event.dataTransfer.files);
    addFiles(droppedFiles);
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  if (compact) {
    return (
      <div className={cn("space-y-2", className)} data-testid="file-upload-compact">
        <Button
          type="button"
          variant="outline"
          onClick={openFileDialog}
          disabled={disabled || files.length >= maxFiles}
          className="w-full"
          data-testid="button-upload-files"
        >
          <Paperclip className="h-4 w-4 mr-2" />
          Attach Files ({files.length}/{maxFiles})
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={handleFileSelect}
          className="hidden"
          data-testid="input-file-hidden"
        />

        {files.length > 0 && (
          <div className="space-y-1">
            {files.map(file => (
              <FileItem key={file.id} file={file} onRemove={removeFile} compact />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)} data-testid="file-upload">
      {/* Drop Zone */}
      <Card
        className={cn(
          "border-2 border-dashed transition-colors cursor-pointer",
          isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={!disabled ? openFileDialog : undefined}
        data-testid="drop-zone"
      >
        <CardContent className="p-8 text-center">
          <Upload className={cn(
            "h-12 w-12 mx-auto mb-4",
            isDragOver ? "text-primary" : "text-muted-foreground"
          )} />
          <h3 className="text-lg font-medium mb-2">
            {isDragOver ? "Drop files here" : "Upload files"}
          </h3>
          <p className="text-muted-foreground mb-4">
            Drag and drop files here, or click to select files
          </p>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>Maximum {maxFiles} files, up to {formatFileSize(maxFileSize)} each</p>
            <p>Supported: PDF, Images (JPEG, PNG, TIFF), Word documents</p>
          </div>
          
          <Button 
            type="button" 
            variant="outline" 
            className="mt-4"
            disabled={disabled || files.length >= maxFiles}
          >
            <Upload className="h-4 w-4 mr-2" />
            Choose Files
          </Button>
        </CardContent>
      </Card>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={acceptedTypes.join(',')}
        onChange={handleFileSelect}
        className="hidden"
        data-testid="input-file-hidden"
      />

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium">Uploaded Files ({files.length})</h4>
          <div className="space-y-2">
            {files.map(file => (
              <FileItem key={file.id} file={file} onRemove={removeFile} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface FileItemProps {
  file: FileWithPreview;
  onRemove: (fileId: string) => void;
  compact?: boolean;
}

function FileItem({ file, onRemove, compact = false }: FileItemProps) {
  const fileType = ACCEPTED_FILE_TYPES[file.type as keyof typeof ACCEPTED_FILE_TYPES];
  const FileIcon = fileType?.icon || File;

  if (compact) {
    return (
      <div className="flex items-center space-x-2 p-2 bg-muted/50 rounded text-sm" data-testid={`file-item-${file.id}`}>
        <FileIcon className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1 truncate">{file.name}</span>
        <Badge variant="outline" className="text-xs">
          {formatFileSize(file.size)}
        </Badge>
        {file.uploadStatus === 'uploading' && (
          <Badge variant="secondary">Uploading...</Badge>
        )}
        {file.uploadStatus === 'success' && (
          <Check className="h-4 w-4 text-green-600" />
        )}
        {file.uploadStatus === 'error' && (
          <AlertTriangle className="h-4 w-4 text-red-600" />
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(file.id);
          }}
          data-testid={`button-remove-${file.id}`}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <Card data-testid={`file-item-${file.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start space-x-4">
          {/* File Icon/Preview */}
          <div className="flex-shrink-0">
            {file.preview ? (
              <img 
                src={file.preview} 
                alt={file.name}
                className="w-12 h-12 object-cover rounded border"
              />
            ) : (
              <div className="w-12 h-12 flex items-center justify-center bg-muted rounded border">
                <FileIcon className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* File Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h4 className="font-medium truncate">{file.name}</h4>
              <div className="flex items-center space-x-2">
                {file.uploadStatus === 'success' && (
                  <Button variant="ghost" size="sm">
                    <Eye className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemove(file.id)}
                  data-testid={`button-remove-${file.id}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-center space-x-4 mt-1">
              <span className="text-sm text-muted-foreground">
                {formatFileSize(file.size)}
              </span>
              <Badge variant="outline" className="text-xs">
                {fileType?.label || file.type}
              </Badge>
            </div>

            {/* Upload Progress */}
            {file.uploadStatus === 'uploading' && (
              <div className="mt-2">
                <Progress value={file.uploadProgress || 0} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  Uploading... {file.uploadProgress || 0}%
                </p>
              </div>
            )}

            {/* Upload Status */}
            {file.uploadStatus === 'success' && (
              <div className="flex items-center space-x-1 mt-2 text-green-600">
                <Check className="h-4 w-4" />
                <span className="text-sm">Upload complete</span>
              </div>
            )}

            {file.uploadStatus === 'error' && (
              <div className="flex items-center space-x-1 mt-2 text-red-600">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">{file.errorMessage || 'Upload failed'}</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatFileSize(bytes: number): string {
  const sizes = ['B', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}