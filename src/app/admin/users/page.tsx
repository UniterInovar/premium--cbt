"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function UserManagementPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; email: string } | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
    if (session && session.user?.role !== "ADMIN" && session.user?.role !== "SUPER_ADMIN") {
      router.replace("/dashboard");
    }

    fetchUsers();
  }, [status, session, router]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      setUsers(data);
    } catch (e) {
      console.error("Failed to fetch users:", e);
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (userId: string) => {
    setDeletingId(userId);
    try {
      const res = await fetch(`/api/admin/users?id=${userId}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setUsers(users.filter(u => u.id !== userId));
        setConfirmDelete(null);
        alert(`User deleted: ${data.email}`);
      } else {
        alert(data.error || "Failed to delete user");
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setDeletingId(null);
    }
  };

  const toggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === "ADMIN" ? "USER" : "ADMIN";
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, role: newRole })
      });
      if (res.ok) {
        fetchUsers();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to update role");
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <main className="container" style={{ padding: '2rem 1rem' }}>
      <div className="flex justify-between items-center" style={{ marginBottom: '2rem' }}>
        <h1 style={{ color: 'var(--accent-color)' }}>User Management</h1>
        <button className="btn btn-secondary" onClick={() => router.push('/admin')}>Back to Admin</button>
      </div>

      <div className="card glass" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
              <th style={{ padding: '1rem' }}>User Email</th>
              <th style={{ padding: '1rem' }}>Role</th>
              <th style={{ padding: '1rem' }}>Registered At</th>
              <th style={{ padding: '1rem' }}>Exams Taken</th>
              <th style={{ padding: '1rem' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center' }}>Loading users...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center' }}>No users found.</td></tr>
            ) : (
              users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '1rem' }}>{u.email}</td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{
                      padding: '0.15rem 0.6rem',
                      borderRadius: '12px',
                      fontSize: '0.8rem',
                      background: u.role === 'SUPER_ADMIN'
                        ? 'rgba(245, 158, 11, 0.15)'
                        : u.role === 'ADMIN'
                          ? 'rgba(16, 185, 129, 0.1)'
                          : 'rgba(59, 130, 246, 0.1)',
                      color: u.role === 'SUPER_ADMIN'
                        ? '#f59e0b'
                        : u.role === 'ADMIN'
                          ? '#10b981'
                          : '#3b82f6',
                      border: `1px solid ${u.role === 'SUPER_ADMIN'
                          ? '#f59e0b'
                          : u.role === 'ADMIN'
                            ? '#10b981'
                            : '#3b82f6'
                        }`
                    }}>
                      {u.role === 'SUPER_ADMIN' ? '👑 Super Admin' : u.role}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td style={{ padding: '1rem' }}>{u._count.examHistories}</td>
                  <td style={{ padding: '1rem' }}>
                    <button
                      className="btn btn-secondary"
                      style={{
                        padding: '0.25rem 0.5rem',
                        borderColor: u.role === 'ADMIN' ? '#ef4444' : 'var(--accent-color)',
                        color: u.role === 'ADMIN' ? '#ef4444' : 'var(--accent-color)'
                      }}
                      disabled={
                        u.email === session?.user?.email ||
                        u.role === 'SUPER_ADMIN'
                      }
                      title={
                        u.role === 'SUPER_ADMIN'
                          ? 'Super Admin role cannot be changed here'
                          : u.email === session?.user?.email
                            ? 'You cannot change your own role'
                            : ''
                      }
                      onClick={() => toggleRole(u.id, u.role)}
                    >
                      {u.role === 'ADMIN' ? 'Revoke Admin' : u.role === 'SUPER_ADMIN' ? '👑 Super Admin' : 'Make Admin'}
                    </button>
                    <button
                      className="btn btn-secondary"
                      style={{
                        padding: '0.25rem 0.5rem',
                        borderColor: '#ef4444',
                        color: '#ef4444',
                        marginLeft: '0.5rem'
                      }}
                      disabled={
                        u.email === session?.user?.email ||
                        deletingId === u.id ||
                        // Regular admins cannot delete other admins or super admins
                        ((u.role === 'ADMIN' || u.role === 'SUPER_ADMIN') &&
                          (session?.user as any)?.role !== 'SUPER_ADMIN') ||
                        // Super admin accounts can never be deleted
                        u.role === 'SUPER_ADMIN'
                      }
                      title={
                        u.role === 'SUPER_ADMIN'
                          ? 'Super Admin accounts cannot be deleted'
                          : (u.role === 'ADMIN' && (session?.user as any)?.role !== 'SUPER_ADMIN')
                            ? 'Only a Super Admin can delete an Admin account'
                            : u.email === session?.user?.email
                              ? 'You cannot delete your own account'
                              : 'Delete this user'
                      }
                      onClick={() => setConfirmDelete({ id: u.id, email: u.email })}
                    >
                      {deletingId === u.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 999
        }}>
          <div className="card glass" style={{ maxWidth: '420px', width: '90%', padding: '2rem' }}>
            <h3 style={{ marginBottom: '1rem', color: '#ef4444' }}>⚠️ Delete User Account?</h3>
            <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
              This will permanently delete <strong>{confirmDelete.email}</strong> along with all their
              exam history. <strong>This action cannot be undone.</strong>
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                className="btn btn-secondary w-full"
                onClick={() => setConfirmDelete(null)}
                disabled={!!deletingId}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary w-full"
                style={{ background: '#ef4444', borderColor: '#ef4444' }}
                onClick={() => deleteUser(confirmDelete.id)}
                disabled={!!deletingId}
              >
                {deletingId ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
