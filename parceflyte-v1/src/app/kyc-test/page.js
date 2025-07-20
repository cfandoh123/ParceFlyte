'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import KYCStepperModal from '@/components/kyc-stepper-modal';

export default function KYCTestPage() {
  const [showModal, setShowModal] = useState(false);
  const [testResults, setTestResults] = useState([]);

  const runTests = async () => {
    const results = [];
    
    // Test 1: Submit KYC application
    try {
      const kycData = {
        personalInfo: {
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1990-01-01',
          nationality: 'US',
          gender: 'male',
        },
        address: {
          currentAddress: {
            street: '123 Main St',
            city: 'New York',
            state: 'NY',
            country: 'US',
            postalCode: '10001',
          },
        },
        contactInfo: {
          phoneNumber: '+1234567890',
          email: 'john.doe@example.com',
        },
      };

      const res = await fetch('/api/kyc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kycData),
      });

      const data = await res.json();
      
      if (res.ok) {
        results.push({
          test: 'KYC Application Submission',
          status: 'PASS',
          data: data.kyc,
        });

        // Test 2: Upload documents
        const documentData = {
          kycId: data.kyc.kycId,
          documentType: 'passport',
          images: [
            {
              type: 'front',
              url: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='
            }
          ]
        };

        const docRes = await fetch('/api/kyc/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(documentData),
        });

        const docData = await docRes.json();
        
        if (docRes.ok) {
          results.push({
            test: 'Document Upload',
            status: 'PASS',
            data: docData,
          });

          // Test 3: Get verification status
          const statusRes = await fetch(`/api/kyc/verify?kycId=${data.kyc.kycId}`);
          const statusData = await statusRes.json();
          
          if (statusRes.ok) {
            results.push({
              test: 'Verification Status',
              status: 'PASS',
              data: statusData,
            });
          } else {
            results.push({
              test: 'Verification Status',
              status: 'FAIL',
              error: statusData.error,
            });
          }
        } else {
          results.push({
            test: 'Document Upload',
            status: 'FAIL',
            error: docData.error,
          });
        }
      } else {
        results.push({
          test: 'KYC Application Submission',
          status: 'FAIL',
          error: data.error,
        });
      }
    } catch (error) {
      results.push({
        test: 'API Tests',
        status: 'ERROR',
        error: error.message,
      });
    }

    setTestResults(results);
  };

  const handleKYCComplete = (kycData) => {
    console.log('KYC completed:', kycData);
    setTestResults(prev => [...prev, {
      test: 'KYC Modal Flow',
      status: 'PASS',
      data: kycData,
    }]);
  };

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">KYC System Test Page</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Test Controls */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Test Controls</h2>
          
          <div className="space-y-2">
            <Button onClick={() => setShowModal(true)} className="w-full">
              Open KYC Modal
            </Button>
            
            <Button onClick={runTests} variant="outline" className="w-full">
              Run API Tests
            </Button>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-800 mb-2">Test Instructions</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Click "Open KYC Modal" to test the UI flow</li>
              <li>• Click "Run API Tests" to test the backend endpoints</li>
              <li>• Check the results below for test outcomes</li>
            </ul>
          </div>
        </div>

        {/* Test Results */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Test Results</h2>
          
          {testResults.length === 0 ? (
            <div className="text-gray-500 text-center py-8">
              No tests run yet. Click "Run API Tests" to start testing.
            </div>
          ) : (
            <div className="space-y-3">
              {testResults.map((result, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{result.test}</h4>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      result.status === 'PASS' ? 'bg-green-100 text-green-800' :
                      result.status === 'FAIL' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {result.status}
                    </span>
                  </div>
                  
                  {result.error && (
                    <Alert variant="destructive" className="mt-2">
                      {result.error}
                    </Alert>
                  )}
                  
                  {result.data && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm text-gray-600">
                        View Response Data
                      </summary>
                      <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                        {JSON.stringify(result.data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* KYC Modal */}
      <KYCStepperModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onComplete={handleKYCComplete}
      />
    </div>
  );
} 