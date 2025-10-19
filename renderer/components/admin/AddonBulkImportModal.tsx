'use client';

import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import {
  Upload,
  Download,
  FileText,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Package,
  DollarSign,
  Tag,
} from 'lucide-react';

interface AddonGroup {
  id: string;
  name: string;
  isActive: boolean;
}

interface ImportItem {
  name: string;
  description?: string;
  price: number;
  addonGroupName: string;
  sortOrder?: number;
  isActive?: boolean;
}

interface ValidationResult {
  valid: ImportItem[];
  invalid: Array<{
    item: any;
    errors: string[];
    lineNumber: number;
  }>;
  warnings: Array<{
    item: ImportItem;
    warnings: string[];
    lineNumber: number;
  }>;
}

interface AddonBulkImportModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (items: ImportItem[]) => Promise<void>;
  addonGroups: AddonGroup[];
}

export function AddonBulkImportModal({
  open,
  onClose,
  onImport,
  addonGroups,
}: AddonBulkImportModalProps) {
  const [importData, setImportData] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [validationResult, setValidationResult] =
    useState<ValidationResult | null>(null);
  const [currentStep, setCurrentStep] = useState<
    'input' | 'preview' | 'importing'
  >('input');
  const [importProgress, setImportProgress] = useState(0);

  const { toast } = useToast();

  // Sample data for users to understand the format
  const sampleData = `name,description,price,addonGroupName,sortOrder,isActive
Extra Cheese,Additional cheese topping,2.50,Pizza Toppings,1,true
Pepperoni,Pepperoni topping,3.00,Pizza Toppings,2,true
Large Size,Upgrade to large size,1.50,Drink Sizes,1,true
Medium Size,Standard medium size,0.00,Drink Sizes,2,true
Small Size,Small size option,-0.50,Drink Sizes,3,true`;

  // Parse CSV data
  const parseCSV = useCallback((csvData: string): any[] => {
    const lines = csvData.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const items: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length !== headers.length) continue;

      const item: any = {};
      headers.forEach((header, index) => {
        const value = values[index];

        if (header === 'price') {
          item[header] = parseFloat(value) || 0;
        } else if (header === 'sortOrder') {
          item[header] = parseInt(value) || 0;
        } else if (header === 'isActive') {
          item[header] = value.toLowerCase() === 'true';
        } else {
          item[header] = value || null;
        }
      });

      item.lineNumber = i + 1;
      items.push(item);
    }

    return items;
  }, []);

  // Validate import data
  const validateImportData = useCallback(
    async (data: string) => {
      setIsValidating(true);

      try {
        const items = parseCSV(data);
        const valid: ImportItem[] = [];
        const invalid: Array<{
          item: any;
          errors: string[];
          lineNumber: number;
        }> = [];
        const warnings: Array<{
          item: ImportItem;
          warnings: string[];
          lineNumber: number;
        }> = [];

        const activeGroupNames = new Set(
          addonGroups.filter(g => g.isActive).map(g => g.name)
        );

        for (const item of items) {
          const errors: string[] = [];
          const itemWarnings: string[] = [];

          // Required field validation
          if (!item.name) errors.push('Name is required');
          if (item.price === undefined || item.price === null)
            errors.push('Price is required');
          if (!item.addonGroupName)
            errors.push('Add-on group name is required');

          // Format validation
          if (item.name && item.name.length > 100) {
            errors.push('Name must be less than 100 characters');
          }
          if (item.description && item.description.length > 500) {
            errors.push('Description must be less than 500 characters');
          }
          if (item.price < 0 || item.price > 999.99) {
            errors.push('Price must be between $0.00 and $999.99');
          }
          if (item.sortOrder && (item.sortOrder < 0 || item.sortOrder > 999)) {
            errors.push('Sort order must be between 0 and 999');
          }

          // Business logic validation
          if (
            item.addonGroupName &&
            !activeGroupNames.has(item.addonGroupName)
          ) {
            errors.push(
              `Add-on group "${item.addonGroupName}" not found or inactive`
            );
          }

          // Warnings
          if (item.price > 50) {
            itemWarnings.push('Price is unusually high');
          }
          if (item.description === item.name) {
            itemWarnings.push('Description is identical to name');
          }

          if (errors.length > 0) {
            invalid.push({ item, errors, lineNumber: item.lineNumber });
          } else {
            const validItem: ImportItem = {
              name: item.name,
              description: item.description || null,
              price: item.price,
              addonGroupName: item.addonGroupName,
              sortOrder: item.sortOrder || 0,
              isActive: item.isActive !== undefined ? item.isActive : true,
            };

            valid.push(validItem);

            if (itemWarnings.length > 0) {
              warnings.push({
                item: validItem,
                warnings: itemWarnings,
                lineNumber: item.lineNumber,
              });
            }
          }
        }

        setValidationResult({ valid, invalid, warnings });
        setCurrentStep('preview');
      } catch (error) {
        toast({
          title: 'Validation Error',
          description: 'Failed to parse CSV data. Please check the format.',
          variant: 'destructive',
        });
      } finally {
        setIsValidating(false);
      }
    },
    [addonGroups, parseCSV, toast]
  );

  // Handle import
  const handleImport = async () => {
    if (!validationResult || validationResult.valid.length === 0) return;

    setIsImporting(true);
    setCurrentStep('importing');
    setImportProgress(0);

    try {
      const items = validationResult.valid;
      const totalItems = items.length;

      // Simulate progress
      for (let i = 0; i <= totalItems; i++) {
        setImportProgress((i / totalItems) * 100);
        if (i < totalItems) {
          await new Promise(resolve => setTimeout(resolve, 100)); // Simulate processing time
        }
      }

      await onImport(items);

      toast({
        title: 'Import Successful',
        description: `Successfully imported ${items.length} add-on${items.length !== 1 ? 's' : ''}`,
      });

      handleClose();
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: 'Import Failed',
        description: 'Failed to import add-ons. Please try again.',
        variant: 'destructive',
      });
      setCurrentStep('preview');
    } finally {
      setIsImporting(false);
      setImportProgress(0);
    }
  };

  const handleClose = () => {
    setImportData('');
    setValidationResult(null);
    setCurrentStep('input');
    setImportProgress(0);
    onClose();
  };

  const downloadTemplate = () => {
    const blob = new Blob([sampleData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'addon-import-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className='max-h-[90vh] max-w-4xl overflow-y-auto'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Upload className='h-5 w-5' />
            Bulk Import Add-ons
          </DialogTitle>
          <DialogDescription>
            Import multiple add-ons from CSV data. Download the template to see
            the required format.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-6'>
          {/* Step 1: Data Input */}
          {currentStep === 'input' && (
            <>
              {/* Template Download */}
              <Card>
                <CardHeader className='pb-3'>
                  <CardTitle className='flex items-center gap-2 text-base'>
                    <FileText className='h-4 w-4' />
                    CSV Template
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='flex items-center justify-between'>
                    <p className='text-sm text-muted-foreground'>
                      Download the CSV template to see the required format and
                      column headers.
                    </p>
                    <Button variant='outline' onClick={downloadTemplate}>
                      <Download className='mr-2 h-4 w-4' />
                      Download Template
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Data Input */}
              <Card>
                <CardHeader className='pb-3'>
                  <CardTitle className='text-base'>CSV Data</CardTitle>
                </CardHeader>
                <CardContent className='space-y-4'>
                  <div className='space-y-2'>
                    <Label htmlFor='csvData'>Paste your CSV data here:</Label>
                    <Textarea
                      id='csvData'
                      placeholder='name,description,price,addonGroupName,sortOrder,isActive&#10;Extra Cheese,Additional cheese topping,2.50,Pizza Toppings,1,true&#10;...'
                      value={importData}
                      onChange={e => setImportData(e.target.value)}
                      rows={10}
                      className='font-mono text-xs'
                    />
                    <p className='text-xs text-muted-foreground'>
                      Required columns: name, price, addonGroupName
                      <br />
                      Optional columns: description, sortOrder, isActive
                    </p>
                  </div>

                  {/* Available Groups Info */}
                  <Alert>
                    <Package className='h-4 w-4' />
                    <AlertDescription>
                      <div className='space-y-1'>
                        <div className='font-medium'>
                          Available Add-on Groups:
                        </div>
                        <div className='flex flex-wrap gap-1'>
                          {addonGroups
                            .filter(g => g.isActive)
                            .map(group => (
                              <Badge
                                key={group.id}
                                variant='outline'
                                className='text-xs'
                              >
                                {group.name}
                              </Badge>
                            ))}
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </>
          )}

          {/* Step 2: Validation Results */}
          {currentStep === 'preview' && validationResult && (
            <>
              {/* Summary */}
              <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
                <Card>
                  <CardContent className='flex items-center gap-2 p-4'>
                    <CheckCircle2 className='h-8 w-8 text-green-600' />
                    <div>
                      <div className='text-2xl font-bold text-green-600'>
                        {validationResult.valid.length}
                      </div>
                      <div className='text-xs text-muted-foreground'>
                        Valid Items
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className='flex items-center gap-2 p-4'>
                    <AlertTriangle className='h-8 w-8 text-orange-500' />
                    <div>
                      <div className='text-2xl font-bold text-orange-500'>
                        {validationResult.warnings.length}
                      </div>
                      <div className='text-xs text-muted-foreground'>
                        Warnings
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className='flex items-center gap-2 p-4'>
                    <AlertCircle className='h-8 w-8 text-red-600' />
                    <div>
                      <div className='text-2xl font-bold text-red-600'>
                        {validationResult.invalid.length}
                      </div>
                      <div className='text-xs text-muted-foreground'>
                        Errors
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Errors */}
              {validationResult.invalid.length > 0 && (
                <Card>
                  <CardHeader className='pb-3'>
                    <CardTitle className='flex items-center gap-2 text-base text-red-600'>
                      <AlertCircle className='h-4 w-4' />
                      Items with Errors ({validationResult.invalid.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className='max-h-40 space-y-3 overflow-y-auto'>
                      {validationResult.invalid.map((item, index) => (
                        <Alert key={index} variant='destructive'>
                          <AlertDescription>
                            <div className='space-y-1'>
                              <div className='font-medium'>
                                Line {item.lineNumber}:{' '}
                                {item.item.name || 'Unnamed Item'}
                              </div>
                              <ul className='list-inside list-disc text-sm'>
                                {item.errors.map((error, errorIndex) => (
                                  <li key={errorIndex}>{error}</li>
                                ))}
                              </ul>
                            </div>
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Warnings */}
              {validationResult.warnings.length > 0 && (
                <Card>
                  <CardHeader className='pb-3'>
                    <CardTitle className='flex items-center gap-2 text-base text-orange-600'>
                      <AlertTriangle className='h-4 w-4' />
                      Items with Warnings ({validationResult.warnings.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className='max-h-40 space-y-3 overflow-y-auto'>
                      {validationResult.warnings.map((item, index) => (
                        <Alert key={index}>
                          <AlertTriangle className='h-4 w-4' />
                          <AlertDescription>
                            <div className='space-y-1'>
                              <div className='font-medium'>
                                Line {item.lineNumber}: {item.item.name}
                              </div>
                              <ul className='list-inside list-disc text-sm text-muted-foreground'>
                                {item.warnings.map((warning, warningIndex) => (
                                  <li key={warningIndex}>{warning}</li>
                                ))}
                              </ul>
                            </div>
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Valid Items Preview */}
              {validationResult.valid.length > 0 && (
                <Card>
                  <CardHeader className='pb-3'>
                    <CardTitle className='flex items-center gap-2 text-base text-green-600'>
                      <CheckCircle2 className='h-4 w-4' />
                      Ready to Import ({validationResult.valid.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className='max-h-60 space-y-2 overflow-y-auto'>
                      {validationResult.valid
                        .slice(0, 10)
                        .map((item, index) => (
                          <div
                            key={index}
                            className='flex items-center justify-between rounded bg-muted/50 p-2'
                          >
                            <div className='flex items-center gap-2'>
                              <Tag className='h-3 w-3 text-muted-foreground' />
                              <span className='font-medium'>{item.name}</span>
                              <Badge variant='outline' className='text-xs'>
                                {item.addonGroupName}
                              </Badge>
                            </div>
                            <div className='flex items-center gap-1 text-sm'>
                              <DollarSign className='h-3 w-3 text-muted-foreground' />
                              {item.price.toFixed(2)}
                            </div>
                          </div>
                        ))}
                      {validationResult.valid.length > 10 && (
                        <div className='py-2 text-center text-xs text-muted-foreground'>
                          ... and {validationResult.valid.length - 10} more
                          items
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Step 3: Importing */}
          {currentStep === 'importing' && (
            <Card>
              <CardContent className='flex flex-col items-center justify-center space-y-4 py-8'>
                <Loader2 className='h-8 w-8 animate-spin text-primary' />
                <div className='space-y-2 text-center'>
                  <div className='font-medium'>Importing add-ons...</div>
                  <div className='text-sm text-muted-foreground'>
                    Please wait while we process your data
                  </div>
                </div>
                <div className='w-full max-w-xs'>
                  <Progress value={importProgress} className='h-2' />
                  <div className='mt-1 text-center text-xs text-muted-foreground'>
                    {importProgress.toFixed(0)}% Complete
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          {currentStep === 'input' && (
            <>
              <Button variant='outline' onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={() => validateImportData(importData)}
                disabled={!importData.trim() || isValidating}
              >
                {isValidating ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Validating...
                  </>
                ) : (
                  'Validate Data'
                )}
              </Button>
            </>
          )}

          {currentStep === 'preview' && validationResult && (
            <>
              <Button variant='outline' onClick={() => setCurrentStep('input')}>
                Back to Edit
              </Button>
              <Button
                onClick={handleImport}
                disabled={
                  validationResult.valid.length === 0 ||
                  validationResult.invalid.length > 0
                }
              >
                Import {validationResult.valid.length} Items
              </Button>
            </>
          )}

          {currentStep === 'importing' && (
            <Button variant='outline' disabled>
              Importing...
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
