'use client';

import {
  AlertCircle,
  AlertTriangle,
  Bluetooth,
  CheckCircle,
  HelpCircle,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  Settings,
  Usb,
  Wifi,
  XCircle,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Printer as IPrinter } from '../../../shared/ipc-types';
import { PrinterAPI } from '../../lib/printer-api';
import { appLogger } from '../../utils/logger';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Label } from '../ui/label';
import { ScrollArea } from '../ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

// Extended printer interface with UI-specific properties
interface PrinterWithStatus extends IPrinter {
  connectionStatus: 'connected' | 'disconnected' | 'testing' | 'unknown';
  lastSeen?: string;
  description?: string;
  status?: number;
  deviceId?: string;
  type?: string;
  connectionType?: string;
  pageSize?: string;
}

export default function PrinterSettings() {
  const [printers, setPrinters] = useState<PrinterWithStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [testingPrinter, setTestingPrinter] = useState<string | null>(null);
  const [systemStatus, setSystemStatus] = useState<
    'initializing' | 'ready' | 'error'
  >('initializing');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // New state for troubleshooting dialog
  const [troubleshootingOpen, setTroubleshootingOpen] = useState(false);
  const [troubleshootingContent, setTroubleshootingContent] = useState<{
    title: string;
    steps: string[];
    suggestions?: string[];
    errorMessage?: string;
  }>({
    title: '',
    steps: [],
  });

  // Selected printer config state
  const [selectedPrinter, setSelectedPrinter] = useState<string>('');
  const [selectedPaperSize, setSelectedPaperSize] = useState<string>('80mm');
  const [selectedPrinterType, setSelectedPrinterType] =
    useState<string>('receipt');

  const fetchPrinters = async (showLoading = true) => {
    if (showLoading) {
      setIsRefreshing(true);
    }

    try {
      // Check if we're in Electron environment
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        appLogger.debug('🖨️ Fetching printers from Electron API...');
        const printersData = await PrinterAPI.getPrinters();
        appLogger.debug('📦 Received printers:', printersData);

        // Add connection status and additional info
        const printersWithStatus: PrinterWithStatus[] = printersData.map(
          (printer: IPrinter) => ({
            ...printer,
            connectionStatus: 'unknown',
            lastSeen: new Date().toLocaleTimeString(),
          })
        );

        setPrinters(printersWithStatus);

        // Set the default printer as the selected one if available
        const defaultPrinter = printersWithStatus.find(p => p.isDefault);
        if (defaultPrinter && !selectedPrinter) {
          setSelectedPrinter(defaultPrinter.name);
        }

        setSystemStatus('ready');
        setLastRefresh(new Date());
        appLogger.debug(
          '✅ Printers loaded successfully:',
          printersWithStatus.length
        );
      } else {
        // Browser fallback with mock data
        appLogger.debug('🌐 Running in browser, using mock printers...');
        const mockPrinters: PrinterWithStatus[] = [
          {
            name: 'RONGTA 80mm Series Printer',
            displayName: 'RONGTA 80mm Series Printer',
            isDefault: true,
            connectionStatus: 'connected',
            lastSeen: new Date().toLocaleTimeString(),
            type: 'Thermal',
            connectionType: 'USB',
            pageSize: '80mm',
          },
          {
            name: 'Microsoft Print to PDF',
            displayName: 'Microsoft Print to PDF',
            isDefault: false,
            connectionStatus: 'connected',
            lastSeen: new Date().toLocaleTimeString(),
            type: 'Document',
            connectionType: 'Virtual',
            pageSize: 'Letter',
          },
        ];
        setPrinters(mockPrinters);

        // Set the default printer as the selected one
        if (
          !selectedPrinter &&
          mockPrinters.length > 0 &&
          mockPrinters[0]?.name
        ) {
          setSelectedPrinter(mockPrinters[0].name);
        }

        setSystemStatus('ready');
        setLastRefresh(new Date());
      }
    } catch (error) {
      appLogger.error('❌ Failed to fetch printers:', error);
      setSystemStatus('error');
      setPrinters([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Direct test print that bypasses all status checks
  const directTestPrint = async (printerName: string) => {
    setTestingPrinter(printerName);
    try {
      appLogger.debug(`🚀 Direct testing printer (bypass): ${printerName}`);

      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        // Use a special "direct" test type that bypasses status checks
        const testResult = await PrinterAPI.testPrint(printerName, 'direct');

        appLogger.debug('📋 Direct test result:', testResult);

        if (testResult.success && testResult.data?.success) {
          // Update printer status to show successful test
          setPrinters(prev =>
            prev.map(p =>
              p.name === printerName
                ? {
                    ...p,
                    connectionStatus: 'connected',
                    lastSeen: new Date().toLocaleTimeString(),
                  }
                : p
            )
          );

          appLogger.debug('✅ Direct test print successful!');

          // Show success dialog
          setTroubleshootingContent({
            title: '✅ Direct Test Print Successful',
            steps: [
              'The direct test page has been sent to your printer bypassing all status checks.',
              'You should see printed output shortly.',
              '',
              `Printer: ${printerName}`,
              `Method Used: ${testResult.data?.method_used || 'Direct Bypass'}`,
              `Time: ${testResult.data?.timestamp || new Date().toISOString()}`,
              '',
              testResult.data?.details || 'Direct test completed successfully.',
              '',
              '🎉 SUCCESS: If you can see this printed page, your printer works despite any status issues!',
              '',
              'This means the "Pending Deletion" or other status warnings can be ignored.',
              'Your printer is ready for POS use.',
            ],
          });
          setTroubleshootingOpen(true);
        } else {
          appLogger.debug('❌ Direct test print failed:', testResult.error);

          const troubleshootingData: any = {
            title: '❌ Direct Test Print Failed',
            steps: [
              'The direct test print failed even with all status checks bypassed.',
              '',
              'This indicates a more serious hardware or driver issue.',
              '',
              'Error Details:',
              testResult.error || 'Unknown error occurred',
              '',
              'Recommended Actions:',
              '1. Check physical printer connection (USB cable, power)',
              '2. Verify printer is powered on and has paper',
              '3. Try printing from another application (Notepad, etc.)',
              '4. Reinstall printer drivers',
              '5. Contact technical support if issue persists',
            ],
          };

          if (testResult.error) {
            troubleshootingData.errorMessage = testResult.error;
          }

          setTroubleshootingContent(troubleshootingData);
          setTroubleshootingOpen(true);
        }
      } else {
        appLogger.debug('❌ Electron API not available');
      }
    } catch (error) {
      appLogger.error('Direct test print error:', error);

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      setTroubleshootingContent({
        title: '❌ Direct Test Print Error',
        steps: [
          'An unexpected error occurred during the direct test.',
          '',
          'Error Details:',
          errorMessage,
          '',
          'Please check the application logs and try again.',
        ],
        errorMessage: errorMessage,
      });
      setTroubleshootingOpen(true);
    } finally {
      setTestingPrinter(null);
    }
  };

  // Diagnostic test print to understand printer character width behavior
  const diagnosticTestPrint = async (printerName: string) => {
    setTestingPrinter(printerName);
    try {
      appLogger.debug(`🔍 Running diagnostic test for printer: ${printerName}`);

      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        // Use "diagnostic" test type to understand printer behavior
        const testResult = await PrinterAPI.testPrint(
          printerName,
          'diagnostic'
        );

        appLogger.debug('📋 Diagnostic test result:', testResult);

        if (testResult.success && testResult.data?.success) {
          // Update printer status
          setPrinters(prev =>
            prev.map(p =>
              p.name === printerName
                ? {
                    ...p,
                    connectionStatus: 'connected',
                    lastSeen: new Date().toLocaleTimeString(),
                  }
                : p
            )
          );

          appLogger.debug('✅ Diagnostic test successful!');

          // Show diagnostic results dialog
          setTroubleshootingContent({
            title: '🔍 Diagnostic Test Completed',
            steps: [
              'Diagnostic test has been sent to your printer.',
              'Check the printed output to understand text formatting behavior.',
              '',
              `Printer: ${printerName}`,
              `Method Used: ${testResult.data?.method_used || 'Diagnostic Test'}`,
              `Time: ${testResult.data?.timestamp || new Date().toISOString()}`,
              '',
              'The printed page contains:',
              '• Lines of different lengths (1-70 characters)',
              '• Character count rulers',
              '• Alphabet sequences',
              '',
              '📏 Examine the printed output to see:',
              '• How much of each line prints',
              '• Whether text appears narrow with margins',
              '• What the actual character width limit is',
              '',
              "This will help us understand your printer's configuration.",
            ],
          });
          setTroubleshootingOpen(true);
        } else {
          appLogger.debug('❌ Diagnostic test failed:', testResult.error);

          const troubleshootingData: any = {
            title: '❌ Diagnostic Test Failed',
            steps: [
              'The diagnostic test failed to complete.',
              '',
              'Error Details:',
              testResult.error || 'Unknown error occurred',
              '',
              'Try using the Direct Test instead, or check:',
              '1. Printer power and paper',
              '2. USB/network connection',
              '3. Printer driver status',
            ],
          };

          if (testResult.error) {
            troubleshootingData.errorMessage = testResult.error;
          }

          setTroubleshootingContent(troubleshootingData);
          setTroubleshootingOpen(true);
        }
      } else {
        appLogger.debug('❌ Electron API not available');
      }
    } catch (error) {
      appLogger.error('Diagnostic test error:', error);

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      setTroubleshootingContent({
        title: '❌ Diagnostic Test Error',
        steps: [
          'An unexpected error occurred during the diagnostic test.',
          '',
          'Error Details:',
          errorMessage,
          '',
          'Please check the application logs and try again.',
        ],
        errorMessage: errorMessage,
      });
      setTroubleshootingOpen(true);
    } finally {
      setTestingPrinter(null);
    }
  };

  // Ultimate thermal test: Direct USB hardware control
  const ultimateThermalTestPrint = async (printerName: string) => {
    setTestingPrinter(printerName);
    try {
      appLogger.debug(
        `🚀 Testing ultimate thermal printing (direct USB) for printer: ${printerName}`
      );

      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        // Use "ultimate_thermal" test type
        const testResult = await PrinterAPI.testPrint(
          printerName,
          'ultimate_thermal'
        );

        appLogger.debug('📋 Ultimate thermal test result:', testResult);

        if (testResult.success && testResult.data?.success) {
          // Update printer status
          setPrinters(prev =>
            prev.map(p =>
              p.name === printerName
                ? {
                    ...p,
                    connectionStatus: 'connected',
                    lastSeen: new Date().toLocaleTimeString(),
                  }
                : p
            )
          );

          appLogger.debug('✅ Ultimate thermal test successful!');

          // Show success dialog
          setTroubleshootingContent({
            title: '🚀 Ultimate Solution Successful!',
            steps: [
              'THE ULTIMATE THERMAL SOLUTION WORKS!',
              '',
              'This is the most advanced thermal printing solution:',
              '• electron-pos-printer for beautiful content formatting',
              '• Direct USB hardware communication bypassing Windows drivers',
              '• Multiple fallback methods for maximum compatibility',
              '• True hardware-level paper cutting control',
              '',
              `Printer: ${printerName}`,
              `Method Used: ${testResult.data?.method_used || 'Ultimate Thermal (Direct USB Hardware)'}`,
              `Time: ${testResult.data?.timestamp || new Date().toISOString()}`,
              '',
              'Revolutionary advantages:',
              '🎯 Full-width text without any scaling issues',
              '🎨 Professional CSS-style formatting for thermal printers',
              '🔌 Direct USB communication bypassing Windows limitations',
              '✂️ Automatic paper cutting and feeding',
              '🔄 Multiple communication methods (USB, Serial, Enhanced PowerShell)',
              '🛡️ Robust error handling with graceful fallbacks',
              '',
              '🎉 BREAKTHROUGH: This is the definitive solution!',
              '',
              'What you should see:',
              '1. Beautiful, properly formatted content using full paper width',
              '2. Automatic paper cutting after printing',
              '3. No narrow text or scaling artifacts',
              '4. Professional thermal printer output quality',
              '',
              'If successful, we can implement this for ALL receipt printing!',
              '',
              '🏆 This solves all your thermal printing challenges!',
            ],
          });
          setTroubleshootingOpen(true);
        } else {
          appLogger.debug('❌ Ultimate thermal test failed:', testResult.error);

          const troubleshootingData: any = {
            title: '❌ Ultimate Solution Analysis',
            steps: [
              'The ultimate thermal solution encountered challenges.',
              '',
              'Error Details:',
              testResult.error || 'Unknown error occurred',
              '',
              'This comprehensive solution attempted:',
              '1. Direct USB thermal printer communication via @node-escpos',
              '2. Alternative USB device detection and connection',
              '3. Serial port communication (COM1-COM5)',
              '4. Enhanced PowerShell with multiple printer targeting approaches',
              '',
              'Possible causes:',
              '• USB driver requirements (may need WinUSB driver via Zadig)',
              '• Printer not ESC/POS compatible',
              '• USB permissions or security restrictions',
              '• Printer firmware limitations',
              '• Network/USB cable connectivity issues',
              '',
              'Recommended next steps:',
              '1. Install Zadig and WinUSB driver for USB thermal printer',
              '2. Check printer ESC/POS compatibility',
              '3. Try different USB port or cable',
              '4. Use "Thermal Fix" button for content-only solution',
              '',
              'Note: The content formatting part should still work beautifully!',
            ],
          };

          if (testResult.error) {
            troubleshootingData.errorMessage = testResult.error;
          }

          setTroubleshootingContent(troubleshootingData);
          setTroubleshootingOpen(true);
        }
      } else {
        appLogger.debug('❌ Electron API not available');
      }
    } catch (error) {
      appLogger.error('Ultimate thermal test error:', error);

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      setTroubleshootingContent({
        title: '❌ Ultimate Solution Error',
        steps: [
          'An unexpected error occurred during the ultimate thermal test.',
          '',
          'Error Details:',
          errorMessage,
          '',
          'The ultimate solution uses advanced hardware communication methods.',
          'Please check the application logs for detailed error information.',
          '',
          'Fallback options:',
          '• Try the "Thermal Fix" button for content formatting',
          '• Use "⚡ Complete Solution" for hybrid approach',
          '• Check printer connectivity and drivers',
        ],
        errorMessage: errorMessage,
      });
      setTroubleshootingOpen(true);
    } finally {
      setTestingPrinter(null);
    }
  };

  // Hybrid thermal test: electron-pos-printer + ESC/POS cutting
  const hybridThermalTestPrint = async (printerName: string) => {
    setTestingPrinter(printerName);
    try {
      appLogger.debug(
        `🔧 Testing hybrid thermal printing for printer: ${printerName}`
      );

      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        // Use "hybrid_thermal" test type
        const testResult = await PrinterAPI.testPrint(
          printerName,
          'hybrid_thermal'
        );

        appLogger.debug('📋 Hybrid thermal test result:', testResult);

        if (testResult.success && testResult.data?.success) {
          // Update printer status
          setPrinters(prev =>
            prev.map(p =>
              p.name === printerName
                ? {
                    ...p,
                    connectionStatus: 'connected',
                    lastSeen: new Date().toLocaleTimeString(),
                  }
                : p
            )
          );

          appLogger.debug('✅ Hybrid thermal test successful!');

          // Show success dialog
          setTroubleshootingContent({
            title: '🎉 Hybrid Thermal Test Successful',
            steps: [
              'The hybrid thermal test completed successfully!',
              '',
              'This solution combines:',
              '• electron-pos-printer for beautiful content formatting',
              '• Direct ESC/POS commands for automatic paper cutting',
              '',
              `Printer: ${printerName}`,
              `Method Used: ${testResult.data?.method_used || 'Hybrid Thermal (Content + Cutting)'}`,
              `Time: ${testResult.data?.timestamp || new Date().toISOString()}`,
              '',
              'Key benefits:',
              '✓ Full-width text without scaling issues',
              '✓ Professional CSS-style formatting',
              '✓ Automatic paper cutting and feeding',
              '✓ Bypasses Windows driver limitations',
              '',
              '🎯 SUCCESS: This is the optimal solution!',
              '',
              'You should now see:',
              '1. Beautiful, properly formatted content',
              '2. Full thermal paper width utilization',
              '3. Automatic paper cutting after printing',
              '',
              'If successful, we can update all receipt printing to use this method.',
            ],
          });
          setTroubleshootingOpen(true);
        } else {
          appLogger.debug('❌ Hybrid thermal test failed:', testResult.error);

          const troubleshootingData: any = {
            title: '❌ Hybrid Thermal Test Failed',
            steps: [
              'The hybrid thermal test could not complete successfully.',
              '',
              'Error Details:',
              testResult.error || 'Unknown error occurred',
              '',
              'This could indicate:',
              '1. Paper cutting commands not supported by this printer model',
              '2. Generic/text driver blocking ESC/POS commands',
              '3. USB connection or communication issues',
              '4. Printer firmware limitations',
              '',
              'Troubleshooting steps:',
              '1. Try the "Thermal Fix" button (content only)',
              '2. Check if printer supports ESC/POS commands',
              '3. Consider updating to ESC/POS printer driver',
              '4. Verify printer model compatibility',
              '',
              'The content formatting should still work even if cutting fails.',
            ],
          };

          if (testResult.error) {
            troubleshootingData.errorMessage = testResult.error;
          }

          setTroubleshootingContent(troubleshootingData);
          setTroubleshootingOpen(true);
        }
      } else {
        appLogger.debug('❌ Electron API not available');
      }
    } catch (error) {
      appLogger.error('Hybrid thermal test error:', error);

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      setTroubleshootingContent({
        title: '❌ Hybrid Thermal Test Error',
        steps: [
          'An unexpected error occurred during the hybrid thermal test.',
          '',
          'Error Details:',
          errorMessage,
          '',
          'Please check the application logs and try again.',
          'You can also try the individual "Thermal Fix" test as a fallback.',
        ],
        errorMessage: errorMessage,
      });
      setTroubleshootingOpen(true);
    } finally {
      setTestingPrinter(null);
    }
  };

  // Thermal library test print using electron-pos-printer
  const thermalLibraryTestPrint = async (printerName: string) => {
    setTestingPrinter(printerName);
    try {
      appLogger.debug(
        `🔧 Testing with thermal library for printer: ${printerName}`
      );

      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        // Use "thermal_library" test type for electron-pos-printer
        const testResult = await PrinterAPI.testPrint(
          printerName,
          'thermal_library'
        );

        appLogger.debug('📋 Thermal library test result:', testResult);

        if (testResult.success && testResult.data?.success) {
          // Update printer status
          setPrinters(prev =>
            prev.map(p =>
              p.name === printerName
                ? {
                    ...p,
                    connectionStatus: 'connected',
                    lastSeen: new Date().toLocaleTimeString(),
                  }
                : p
            )
          );

          appLogger.debug('✅ Thermal library test successful!');

          // Show success dialog
          setTroubleshootingContent({
            title: '✅ Thermal Library Test Successful',
            steps: [
              'The thermal library test has been sent using electron-pos-printer.',
              'This bypasses Windows print driver scaling issues.',
              '',
              `Printer: ${printerName}`,
              `Method Used: ${testResult.data?.method_used || 'electron-pos-printer Library'}`,
              `Time: ${testResult.data?.timestamp || new Date().toISOString()}`,
              '',
              'Key advantages of this method:',
              '• Direct thermal printer communication',
              '• No Windows driver scaling/formatting issues',
              '• Proper CSS-style text formatting for thermal printers',
              '• Eliminates narrow text with big margins problem',
              '',
              '🎉 SUCCESS: This method should show proper full-width text!',
              '',
              'If this looks better, we can update all printing to use this method.',
            ],
          });
          setTroubleshootingOpen(true);
        } else {
          appLogger.debug('❌ Thermal library test failed:', testResult.error);

          const troubleshootingData: any = {
            title: '❌ Thermal Library Test Failed',
            steps: [
              'The thermal library test failed to complete.',
              '',
              'Error Details:',
              testResult.error || 'Unknown error occurred',
              '',
              'This could indicate:',
              '1. Printer driver compatibility issues',
              '2. Network connectivity problems (for network printers)',
              '3. Printer busy or offline',
              '4. USB connection issues',
              '',
              'Try the Direct Test as a fallback.',
            ],
          };

          if (testResult.error) {
            troubleshootingData.errorMessage = testResult.error;
          }

          setTroubleshootingContent(troubleshootingData);
          setTroubleshootingOpen(true);
        }
      } else {
        appLogger.debug('❌ Electron API not available');
      }
    } catch (error) {
      appLogger.error('Thermal library test error:', error);

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      setTroubleshootingContent({
        title: '❌ Thermal Library Test Error',
        steps: [
          'An unexpected error occurred during the thermal library test.',
          '',
          'Error Details:',
          errorMessage,
          '',
          'Please check the application logs and try again.',
        ],
        errorMessage: errorMessage,
      });
      setTroubleshootingOpen(true);
    } finally {
      setTestingPrinter(null);
    }
  };

  const testPrint = async (printerName: string) => {
    setTestingPrinter(printerName);
    try {
      appLogger.debug(`🧪 Testing printer: ${printerName}`);

      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        // Get the current configuration for this printer
        const printerInfo = printers.find(p => p.name === printerName);
        const paperSize = selectedPaperSize || printerInfo?.pageSize || '80mm';
        const printerType =
          selectedPrinterType || printerInfo?.type?.toLowerCase() || 'receipt';

        // Send test print with more specific configuration
        const testResult = await PrinterAPI.testPrint(printerName, printerType);

        appLogger.debug('📋 Test print result:', testResult);

        if (testResult.success && testResult.data?.success) {
          // Update printer status to show successful test
          setPrinters(prev =>
            prev.map(p =>
              p.name === printerName
                ? {
                    ...p,
                    connectionStatus: 'connected',
                    lastSeen: new Date().toLocaleTimeString(),
                  }
                : p
            )
          );

          appLogger.debug('✅ Test print successful!');

          // Show success dialog instead of alert
          setTroubleshootingContent({
            title: '✅ Test Print Successful',
            steps: [
              'The test page has been sent to your printer.',
              'You should see printed output shortly.',
              '',
              `Printer: ${printerName}`,
              `Paper Size: ${paperSize}`,
              `Method Used: ${testResult.data?.method_used || 'Default'}`,
              `Time: ${testResult.data?.timestamp || new Date().toISOString()}`,
              '',
              testResult.data?.details || 'Test completed successfully.',
              '',
              'If you see this page printed correctly, your printer is configured properly for receipt printing.',
              '',
              'Next Steps:',
              '• Your printer is ready for use',
              '• Print quality should be clear and readable',
              '• Text should be properly aligned',
            ],
          });
          setTroubleshootingOpen(true);
        } else {
          // Extract detailed error information
          const errorMessage =
            testResult.error ||
            testResult.data?.details ||
            'Unknown error occurred';
          const methodUsed = testResult.data?.method_used || 'Unknown';

          appLogger.error('❌ Test print failed:', errorMessage);

          // Build detailed troubleshooting steps based on the failure
          const troubleshootingSteps = [
            'The test print failed to complete. Details below:',
            '',
            `Method Attempted: ${methodUsed}`,
            `Error Details: ${testResult.data?.details || errorMessage}`,
            `Time: ${testResult.data?.timestamp || new Date().toISOString()}`,
            '',
            'Common Solutions:',
          ];

          // Check for specific "Pending Deletion" error
          if (errorMessage.includes('Pending Deletion')) {
            troubleshootingSteps.push(
              '',
              '⚠️ PRINTER STATUS: "Pending Deletion"',
              '',
              'This usually means there are stuck print jobs. The system is attempting to automatically fix this issue.',
              '',
              'If the automatic fix fails, try these manual steps:',
              '1. Open Windows Services (services.msc)',
              '2. Find "Print Spooler" service',
              '3. Right-click and select "Stop"',
              '4. Navigate to C:\\Windows\\System32\\spool\\PRINTERS',
              '5. Delete all files in this folder',
              '6. Go back to Services and Start "Print Spooler"',
              '7. Retry the test print',
              '',
              'Alternative: Restart Windows to clear the printer status'
            );
          }

          // Add specific guidance based on printer type and error
          if (printerName.includes('RONGTA') || printerName.includes('80mm')) {
            troubleshootingSteps.push(
              '',
              '🖨️ RONGTA/Thermal Printer Specific Checks:',
              '1. Verify RONGTA drivers are installed from manufacturer',
              '2. Check USB connection and try a different USB port',
              '3. Ensure printer is in ESC/POS mode (not label mode)',
              '4. Try power cycling: Turn off → wait 10 seconds → turn on',
              '5. Check if printer appears in Windows Device Manager',
              '6. Verify paper is loaded correctly and not jammed'
            );
          }

          troubleshootingSteps.push(
            '',
            '🔧 General Printer Checks:',
            '1. Is the printer powered on and showing ready status?',
            '2. Are there any error lights or display messages?',
            '3. Is the printer set as online (not paused/offline)?',
            '4. Try printing a Windows test page from printer properties',
            '5. Check Windows Print Spooler service is running',
            '',
            '📋 Advanced Troubleshooting:',
            '1. Update or reinstall printer drivers',
            '2. Try setting printer as default printer',
            '3. Check for Windows updates',
            '4. Restart the application and try again'
          );

          setTroubleshootingContent({
            title: '❌ Test Print Failed',
            steps: troubleshootingSteps,
            errorMessage: errorMessage,
          });
          setTroubleshootingOpen(true);

          // Auto-show RONGTA help if it's a RONGTA printer
          if (printerName.includes('RONGTA')) {
            setTimeout(() => showRongtaDriverHelp(), 2000);
          }
        }
      } else {
        // Browser simulation
        appLogger.debug('🌐 Simulating test print in browser...');
        setTimeout(() => {
          setPrinters(prev =>
            prev.map(p =>
              p.name === printerName
                ? {
                    ...p,
                    connectionStatus: 'connected',
                    lastSeen: new Date().toLocaleTimeString(),
                  }
                : p
            )
          );
          setTroubleshootingContent({
            title: '✅ Test Print Simulated',
            steps: [
              'This is a browser simulation.',
              'In the actual app, a test page would be sent to your printer.',
              '',
              `Printer: ${printerName}`,
              `Time: ${new Date().toLocaleTimeString()}`,
            ],
          });
          setTroubleshootingOpen(true);
          setTestingPrinter(null);
        }, 1500);
      }
    } catch (error) {
      appLogger.error('❌ Test print error:', error);
      setPrinters(prev =>
        prev.map(p =>
          p.name === printerName
            ? {
                ...p,
                connectionStatus: 'disconnected',
                lastSeen: new Date().toLocaleTimeString(),
              }
            : p
        )
      );

      setTroubleshootingContent({
        title: '❌ Test Print Error',
        steps: [
          'An unexpected error occurred while trying to test the printer.',
          '',
          'Error details:',
          error instanceof Error ? error.message : String(error),
          '',
          'Please check your printer connection and try again.',
        ],
      });
      setTroubleshootingOpen(true);
    } finally {
      setTestingPrinter(null);
    }
  };

  useEffect(() => {
    appLogger.debug('🚀 PrinterSettings component mounted');
    setSystemStatus('initializing');
    fetchPrinters();

    // Check for RONGTA printers and show help if needed
    const hasRongtaPrinter = printers.some(p => p.name.includes('RONGTA'));
    if (hasRongtaPrinter && !localStorage.getItem('rongta_help_shown')) {
      localStorage.setItem('rongta_help_shown', 'true');
      setTimeout(() => {
        showRongtaDriverHelp();
      }, 1000);
    }
  }, []);

  const getConnectionIcon = (
    _connectionStatus: string,
    connectionType?: string
  ) => {
    switch (connectionType?.toLowerCase()) {
      case 'usb':
        return <Usb className='h-4 w-4' />;
      case 'network':
        return <Wifi className='h-4 w-4' />;
      case 'bluetooth':
        return <Bluetooth className='h-4 w-4' />;
      default:
        return <Printer className='h-4 w-4' />;
    }
  };

  const getStatusBadge = (connectionStatus: string) => {
    switch (connectionStatus) {
      case 'connected':
        return (
          <Badge variant='default' className='bg-green-500 hover:bg-green-600'>
            <CheckCircle className='mr-1 h-3 w-3' />
            Connected
          </Badge>
        );
      case 'testing':
        return (
          <Badge variant='secondary'>
            <Loader2 className='mr-1 h-3 w-3 animate-spin' />
            Testing...
          </Badge>
        );
      case 'disconnected':
        return (
          <Badge variant='destructive'>
            <XCircle className='mr-1 h-3 w-3' />
            Disconnected
          </Badge>
        );
      default:
        return (
          <Badge variant='outline'>
            <AlertCircle className='mr-1 h-3 w-3' />
            Unknown
          </Badge>
        );
    }
  };

  const getSystemStatusIndicator = () => {
    switch (systemStatus) {
      case 'initializing':
        return (
          <div className='flex items-center gap-2 text-blue-600'>
            <Loader2 className='h-4 w-4 animate-spin' />
            <span className='text-sm'>Initializing printer system...</span>
          </div>
        );
      case 'ready':
        return (
          <div className='flex items-center gap-2 text-green-600'>
            <CheckCircle className='h-4 w-4' />
            <span className='text-sm'>
              Printer system ready ({printers.length} printers found)
            </span>
            {lastRefresh && (
              <span className='ml-2 text-xs text-muted-foreground'>
                Last updated: {lastRefresh.toLocaleTimeString()}
              </span>
            )}
          </div>
        );
      case 'error':
        return (
          <div className='flex items-center gap-2 text-red-600'>
            <XCircle className='h-4 w-4' />
            <span className='text-sm'>Printer system error</span>
          </div>
        );
    }
  };

  const getPrinterTypeTag = (type?: string) => {
    switch (type?.toLowerCase()) {
      case 'thermal':
        return <Badge className='bg-blue-500 hover:bg-blue-600'>Thermal</Badge>;
      case 'kitchen':
        return (
          <Badge className='bg-orange-500 hover:bg-orange-600'>Kitchen</Badge>
        );
      case 'bar':
        return <Badge className='bg-purple-500 hover:bg-purple-600'>Bar</Badge>;
      case 'document':
        return (
          <Badge className='bg-gray-500 hover:bg-gray-600'>Document</Badge>
        );
      default:
        return <Badge variant='outline'>Generic</Badge>;
    }
  };

  const showThermalPrinterHelp = () => {
    setTroubleshootingContent({
      title: 'Thermal Printer Setup Guide',
      steps: [
        '1. DRIVER SETUP (MOST IMPORTANT)',
        '   • Thermal printers require "Generic / Text Only" driver',
        '   • Open Windows "Devices and Printers"',
        '   • Right-click your printer → Properties → Advanced',
        '   • Check "Print directly to the printer"',
        '   • If driver is not "Generic / Text Only", add new printer with this driver',
        '',
        '2. CONNECTION SETUP',
        '   • USB printers work best in USB 2.0 ports (not always USB 3.0)',
        '   • For network printers, ensure stable IP address',
        '   • Try sharing the printer locally for better compatibility',
        '',
        '3. PAPER SIZE',
        '   • Most receipt printers use 80mm or 58mm paper',
        '   • Verify your paper width and set correctly',
        '',
        '4. TESTING',
        '   • Always run a test print after setup',
        '   • Check print quality and text alignment',
        '',
        '5. COMMON ISSUES',
        '   • Windows often installs wrong drivers automatically',
        '   • Some printers need manufacturer-specific drivers first',
        '   • Print spooler service may need restart if print jobs get stuck',
        '',
        'For RONGTA printers specifically:',
        '• Use Generic/Text Only driver',
        '• Enable direct port printing with USB001 or RongtaUSB PORT',
        '• Set correct paper width (usually 80mm)',
      ],
    });
    setTroubleshootingOpen(true);
  };

  // Add new RONGTA-specific help function
  const showRongtaDriverHelp = () => {
    setTroubleshootingContent({
      title: 'RONGTA Printer Setup Guide',
      steps: [
        '1. Open Windows Control Panel > Devices and Printers',
        '2. Right-click on your RONGTA printer and select "Remove device"',
        '3. Reconnect your printer to USB',
        '4. When Windows detects it, go to Control Panel > Devices and Printers',
        '5. Right-click on the printer and select "Printer properties"',
        '6. Click the "Change Properties" button if prompted',
        '7. Go to the "Advanced" tab',
        '8. Make sure "Print directly to the printer" is checked',
        '9. Click on "New Driver..." button',
        '10. In the wizard, select "Generic" manufacturer',
        '11. Select "Generic / Text Only" as the printer model',
        '12. Complete the wizard and click "Apply"',
        '13. Return to the POS system and try printing again',
        '',
        "If the above steps don't work, try these additional steps:",
        '',
        '1. Download the latest RONGTA driver from their official website',
        '2. Install the driver according to their instructions',
        '3. Make sure to select "Generic / Text Only" when prompted for driver type',
        '4. Restart your computer',
        '5. Return to the POS system and try printing again',
      ],
    });
    setTroubleshootingOpen(true);
  };

  return (
    <div className='space-y-6'>
      {/* System Status Header */}
      <Card>
        <CardHeader className='pb-3'>
          <div className='flex items-center justify-between'>
            <CardTitle className='text-lg'>Printer System Status</CardTitle>
            <Button
              variant='outline'
              size='sm'
              onClick={() => fetchPrinters()}
              disabled={isLoading || isRefreshing}
            >
              {isRefreshing ? (
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              ) : (
                <RefreshCw className='mr-2 h-4 w-4' />
              )}
              Refresh Printers
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {getSystemStatusIndicator()}

          {/* Quick thermal printer setup help */}
          <div className='mt-3 flex items-center rounded-md border border-amber-200 bg-amber-50 p-2'>
            <AlertTriangle className='mr-2 h-4 w-4 text-amber-600' />
            <span className='text-xs text-amber-800'>
              Using a thermal receipt printer? Make sure it has the "Generic /
              Text Only" driver.
            </span>
            <Button
              variant='link'
              className='ml-auto h-auto p-0 text-xs text-amber-700'
              onClick={showThermalPrinterHelp}
            >
              Setup Guide
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Available Printers */}
      <Card>
        <CardHeader>
          <CardTitle>Available Printers</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='flex items-center justify-center py-8'>
              <Loader2 className='mr-2 h-6 w-6 animate-spin' />
              <span>Scanning for printers...</span>
            </div>
          ) : printers.length === 0 ? (
            <div className='py-8 text-center text-muted-foreground'>
              <Printer className='mx-auto mb-4 h-12 w-12 opacity-50' />
              <p>No printers found</p>
              <Button
                variant='outline'
                onClick={() => fetchPrinters()}
                className='mt-4'
              >
                Scan Again
              </Button>
            </div>
          ) : (
            <div className='space-y-4'>
              {printers.map((printer, index) => (
                <div
                  key={printer.deviceId || index}
                  className={`rounded-lg border p-4 transition-colors hover:bg-muted/50 ${
                    selectedPrinter === printer.name
                      ? 'border-blue-400 bg-blue-50'
                      : ''
                  }`}
                >
                  {/* Main printer info row */}
                  <div className='flex items-start justify-between gap-4'>
                    {/* Left side: Icon and printer details */}
                    <div className='flex min-w-0 flex-1 items-start gap-3'>
                      <div className='mt-1 flex-shrink-0'>
                        {getConnectionIcon(
                          printer.connectionStatus,
                          printer.connectionType
                        )}
                      </div>
                      <div className='min-w-0 flex-1'>
                        <div className='flex items-center gap-2'>
                          <h3
                            className='truncate font-medium'
                            title={printer.name}
                          >
                            {printer.name}
                          </h3>
                          {getPrinterTypeTag(printer.type)}
                        </div>
                        <p
                          className='line-clamp-2 break-words text-sm text-muted-foreground'
                          title={printer.description}
                        >
                          {printer.description}
                        </p>
                      </div>
                    </div>

                    {/* Right side: Status and actions */}
                    <div className='flex flex-shrink-0 items-center gap-3'>
                      {getStatusBadge(
                        testingPrinter === printer.name
                          ? 'testing'
                          : printer.connectionStatus
                      )}
                      <div className='flex gap-2'>
                        <Button
                          variant={
                            selectedPrinter === printer.name
                              ? 'default'
                              : 'outline'
                          }
                          size='sm'
                          onClick={() => setSelectedPrinter(printer.name)}
                          className='whitespace-nowrap'
                        >
                          {selectedPrinter === printer.name ? (
                            <CheckCircle className='mr-2 h-4 w-4' />
                          ) : (
                            <Settings className='mr-2 h-4 w-4' />
                          )}
                          {selectedPrinter === printer.name
                            ? 'Selected'
                            : 'Select'}
                        </Button>
                        <Button
                          variant='outline'
                          size='sm'
                          onClick={() => ultimateThermalTestPrint(printer.name)}
                          disabled={testingPrinter === printer.name}
                          className='whitespace-nowrap border-purple-300 bg-gradient-to-r from-purple-50 to-pink-50 font-bold text-purple-800 shadow-md hover:from-purple-100 hover:to-pink-100'
                          title='🚀 ULTIMATE SOLUTION: Direct USB hardware control bypassing Windows drivers completely - the most advanced thermal printing solution'
                        >
                          {testingPrinter === printer.name ? (
                            <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                          ) : (
                            <Zap className='mr-2 h-4 w-4 text-purple-600' />
                          )}
                          Test Print
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Bottom info row */}
                  <div className='mt-3 flex flex-wrap items-center gap-2'>
                    <span className='whitespace-nowrap rounded bg-muted px-2 py-1 text-xs'>
                      {printer.connectionType} • {printer.pageSize}
                    </span>
                    {printer.isDefault && (
                      <span className='whitespace-nowrap rounded bg-blue-100 px-2 py-1 text-xs text-blue-800'>
                        Default
                      </span>
                    )}
                    {selectedPrinter === printer.name && (
                      <span className='whitespace-nowrap rounded bg-green-100 px-2 py-1 text-xs text-green-800'>
                        Selected for POS
                      </span>
                    )}
                    {printer.lastSeen && (
                      <span className='whitespace-nowrap text-xs text-muted-foreground'>
                        Last seen: {printer.lastSeen}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Printer Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Selected Printer Configuration</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid grid-cols-1 gap-4'>
            <div>
              <Label htmlFor='selectedPrinter'>Selected Printer</Label>
              <Select
                value={selectedPrinter}
                onValueChange={setSelectedPrinter}
              >
                <SelectTrigger>
                  <SelectValue placeholder='Select a printer' />
                </SelectTrigger>
                <SelectContent>
                  {printers.map((printer, index) => (
                    <SelectItem key={index} value={printer.name}>
                      {printer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!selectedPrinter && (
                <p className='mt-1 text-xs text-red-500'>
                  Please select a printer for receipt printing
                </p>
              )}
            </div>
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <Label htmlFor='printerType'>Printer Type</Label>
                <Select
                  value={selectedPrinterType}
                  onValueChange={setSelectedPrinterType}
                >
                  <SelectTrigger>
                    <SelectValue placeholder='Select printer type' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='receipt'>Receipt Printer</SelectItem>
                    <SelectItem value='kitchen'>Kitchen Printer</SelectItem>
                    <SelectItem value='bar'>Bar Printer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor='pageSize'>Paper Size</Label>
                <Select
                  value={selectedPaperSize}
                  onValueChange={setSelectedPaperSize}
                >
                  <SelectTrigger>
                    <SelectValue placeholder='Select paper size' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='80mm'>80mm</SelectItem>
                    <SelectItem value='58mm'>58mm</SelectItem>
                    <SelectItem value='76mm'>76mm</SelectItem>
                    <SelectItem value='57mm'>57mm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className='flex justify-between'>
            <Button variant='outline' onClick={showThermalPrinterHelp}>
              <HelpCircle className='mr-2 h-4 w-4' />
              Setup Help
            </Button>
            <Button
              disabled={!selectedPrinter}
              onClick={() =>
                selectedPrinter && ultimateThermalTestPrint(selectedPrinter)
              }
              className='border-purple-300 bg-gradient-to-r from-purple-50 to-pink-50 font-bold text-purple-800 shadow-md hover:from-purple-100 hover:to-pink-100'
            >
              <Zap className='mr-2 h-4 w-4 text-purple-600' />
              Test Selected Printer
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Debug Information */}
      <Card>
        <CardHeader>
          <CardTitle className='text-sm'>Debug Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='space-y-1 font-mono text-xs text-muted-foreground'>
            <div>
              Environment:{' '}
              {typeof window !== 'undefined' && (window as any).electronAPI
                ? 'Electron'
                : 'Browser'}
            </div>
            <div>System Status: {systemStatus}</div>
            <div>Printers Found: {printers.length}</div>
            <div>Selected Printer: {selectedPrinter || 'None'}</div>
            <div>Selected Paper Size: {selectedPaperSize}</div>
            <div>Last Refresh: {lastRefresh?.toLocaleString() || 'Never'}</div>
          </div>
        </CardContent>
      </Card>

      {/* Troubleshooting Dialog */}
      <Dialog open={troubleshootingOpen} onOpenChange={setTroubleshootingOpen}>
        <DialogContent
          className='max-w-2xl'
          aria-describedby='troubleshooting-description'
        >
          <DialogHeader>
            <DialogTitle>{troubleshootingContent.title}</DialogTitle>
            <DialogDescription
              id='troubleshooting-description'
              className={
                troubleshootingContent.errorMessage ? 'text-red-500' : ''
              }
            >
              {troubleshootingContent.errorMessage ||
                'Printer troubleshooting and setup guidance dialog.'}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue='steps'>
            <TabsList className='grid w-full grid-cols-2'>
              <TabsTrigger value='steps'>Troubleshooting</TabsTrigger>
              <TabsTrigger value='setup'>Setup Suggestions</TabsTrigger>
            </TabsList>
            <TabsContent value='steps' className='mt-2'>
              <ScrollArea className='h-[300px] rounded-md border p-4'>
                <div className='space-y-2 whitespace-pre-wrap font-mono text-sm'>
                  {troubleshootingContent.steps.map((step, index) => (
                    <div key={index}>{step}</div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
            <TabsContent value='setup' className='mt-2'>
              <ScrollArea className='h-[300px] rounded-md border p-4'>
                <div className='space-y-2'>
                  {troubleshootingContent.suggestions &&
                  troubleshootingContent.suggestions.length > 0 ? (
                    troubleshootingContent.suggestions.map(
                      (suggestion, index) => (
                        <div
                          key={index}
                          className='whitespace-pre-wrap font-mono text-sm'
                        >
                          {suggestion}
                        </div>
                      )
                    )
                  ) : (
                    <div className='flex flex-col items-center justify-center py-8'>
                      <Settings className='mb-2 h-10 w-10 text-muted-foreground' />
                      <p className='text-center text-muted-foreground'>
                        No specific setup suggestions available.
                        <br />
                        Please check the troubleshooting tab for more
                        information.
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button onClick={() => setTroubleshootingOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
