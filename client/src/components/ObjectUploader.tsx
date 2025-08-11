import { useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ObjectUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  onGetUploadParameters: () => Promise<{
    method: "PUT";
    url: string;
  }>;
  onComplete?: (files: Array<{ url: string; name: string; size: number; type: string }>) => void;
  buttonClassName?: string;
  children: ReactNode;
  accept?: string;
}

export function ObjectUploader({
  maxNumberOfFiles = 1,
  maxFileSize = 10485760, // 10MB default
  onGetUploadParameters,
  onComplete,
  buttonClassName,
  children,
  accept = ".pdf,.jpg,.jpeg,.png",
}: ObjectUploaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    // Validate file count
    if (files.length > maxNumberOfFiles) {
      toast({
        title: "Too many files",
        description: `Maximum ${maxNumberOfFiles} files allowed`,
        variant: "destructive",
      });
      return;
    }

    // Validate file sizes
    const oversizedFiles = files.filter(file => file.size > maxFileSize);
    if (oversizedFiles.length > 0) {
      toast({
        title: "File too large",
        description: `Maximum file size is ${(maxFileSize / 1048576).toFixed(1)}MB`,
        variant: "destructive",
      });
      return;
    }

    setSelectedFiles(files);
  };

  const uploadFile = async (file: File): Promise<{ url: string; name: string; size: number; type: string }> => {
    try {
      // Get upload parameters
      const { url } = await onGetUploadParameters();
      
      // Upload file
      const response = await fetch(url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      return {
        url: url.split('?')[0], // Remove query parameters
        name: file.name,
        size: file.size,
        type: file.type,
      };
    } catch (error) {
      throw new Error(`Failed to upload ${file.name}`);
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    const uploadedFiles: Array<{ url: string; name: string; size: number; type: string }> = [];

    try {
      for (const file of selectedFiles) {
        setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));
        
        const uploadedFile = await uploadFile(file);
        uploadedFiles.push(uploadedFile);
        
        setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));
      }

      toast({
        title: "Upload successful",
        description: `${uploadedFiles.length} file(s) uploaded successfully`,
      });

      onComplete?.(uploadedFiles);
      setIsOpen(false);
      setSelectedFiles([]);
      setUploadProgress({});
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload files",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className={buttonClassName} data-testid="upload-trigger">
          {children}
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Files</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* File Input */}
          <div>
            <input
              type="file"
              id="file-upload"
              multiple={maxNumberOfFiles > 1}
              accept={accept}
              onChange={handleFileSelect}
              className="hidden"
              data-testid="file-input"
            />
            <label
              htmlFor="file-upload"
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <i className="fas fa-cloud-upload-alt text-2xl text-slate-400 mb-2"></i>
                <p className="mb-2 text-sm text-slate-500">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-slate-500">
                  {accept.replace(/\./g, '').toUpperCase()} up to {(maxFileSize / 1048576).toFixed(0)}MB
                </p>
              </div>
            </label>
          </div>

          {/* Selected Files */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-slate-900">Selected Files</h4>
              <ul className="space-y-2">
                {selectedFiles.map((file, index) => (
                  <li key={index} className="flex items-center justify-between p-2 bg-slate-50 rounded-md" data-testid={`selected-file-${index}`}>
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-primary-100 rounded flex items-center justify-center">
                        <i className={`fas ${file.type.includes('pdf') ? 'fa-file-pdf text-red-500' : 'fa-image text-blue-500'} text-sm`}></i>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900 truncate max-w-[200px]">{file.name}</p>
                        <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    
                    {uploading && uploadProgress[file.name] !== undefined ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-16 bg-slate-200 rounded-full h-2">
                          <div 
                            className="bg-primary-600 h-2 rounded-full transition-all"
                            style={{ width: `${uploadProgress[file.name]}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-slate-500">{uploadProgress[file.name]}%</span>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeFile(index)}
                        disabled={uploading}
                        data-testid={`remove-file-${index}`}
                      >
                        <i className="fas fa-times text-slate-400"></i>
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Upload Button */}
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={uploading}
              data-testid="cancel-upload"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={selectedFiles.length === 0 || uploading}
              data-testid="start-upload"
            >
              {uploading ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Uploading...
                </>
              ) : (
                <>
                  <i className="fas fa-upload mr-2"></i>
                  Upload {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
