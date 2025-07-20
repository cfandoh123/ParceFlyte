'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import AdminKYCReviewModal from '@/components/admin-kyc-review-modal';

export default function AdminKYCDashboard() {
  const [applications, setApplications] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });
  const [selected, setSelected] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
    fetchStats();
  }, [pagination.page]);

  async function fetchData() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/kyc?page=${pagination.page}&limit=${pagination.limit}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch applications');
      setApplications(data.applications);
      setPagination(data.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchStats() {
    try {
      const res = await fetch('/api/admin/kyc?status=statistics');
      const data = await res.json();
      if (res.ok) setStats(data.statistics);
    } catch {}
  }

  return (
    <div className="container mx-auto p-8 max-w-5xl">
      <h1 className="text-3xl font-bold mb-6">Admin KYC Dashboard</h1>
      <div className="flex flex-wrap gap-4 mb-6">
        {stats && Object.entries(stats).map(([key, value]) => (
          <div key={key} className="bg-gray-50 border rounded-lg px-4 py-2 flex flex-col items-center">
            <span className="text-xs text-gray-500 uppercase">{key}</span>
            <span className="text-lg font-semibold">{value}</span>
          </div>
        ))}
      </div>
      {error && <Alert variant="destructive">{error}</Alert>}
      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">User</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left">Submitted</th>
              <th className="p-2 text-left">Risk</th>
              <th className="p-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center p-4">Loading...</td></tr>
            ) : applications.length === 0 ? (
              <tr><td colSpan={5} className="text-center p-4">No pending applications.</td></tr>
            ) : (
              applications.map(app => (
                <tr key={app.kycId} className="border-b hover:bg-gray-50">
                  <td className="p-2 font-medium">{app.personalInfo?.firstName} {app.personalInfo?.lastName}</td>
                  <td className="p-2"><Badge variant={app.verificationProcess?.status === 'pending' ? 'secondary' : 'outline'}>{app.verificationProcess?.status}</Badge></td>
                  <td className="p-2">{app.verificationProcess?.submittedAt ? new Date(app.verificationProcess.submittedAt).toLocaleDateString() : '-'}</td>
                  <td className="p-2">
                    <Badge variant={app.riskAssessment?.riskLevel === 'high' ? 'destructive' : app.riskAssessment?.riskLevel === 'medium' ? 'warning' : 'success'}>
                      {app.riskAssessment?.riskLevel || 'low'}
                    </Badge>
                  </td>
                  <td className="p-2">
                    <Button size="sm" onClick={() => setSelected(app)}>Review</Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between items-center mt-4">
        <Button disabled={pagination.page === 1} onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}>Previous</Button>
        <span>Page {pagination.page} of {pagination.pages}</span>
        <Button disabled={pagination.page === pagination.pages} onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}>Next</Button>
      </div>
      <AdminKYCReviewModal
        application={selected}
        onClose={() => setSelected(null)}
        onAction={fetchData}
      />
    </div>
  );
} 