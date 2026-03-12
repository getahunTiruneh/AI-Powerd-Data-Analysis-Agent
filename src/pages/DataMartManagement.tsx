import { useEffect, useState } from 'react';
import { Database, Plus, CreditCard as Edit, Trash2, Power, PowerOff } from 'lucide-react';
import { supabase, DataMart } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function DataMartManagement() {
  const [dataMarts, setDataMarts] = useState<DataMart[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const { profile } = useAuth();

  useEffect(() => {
    loadDataMarts();
  }, []);

  const loadDataMarts = async () => {
    try {
      const { data, error } = await supabase
        .from('data_marts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDataMarts(data || []);
    } catch (error) {
      console.error('Error loading data marts:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleDataMartStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('data_marts')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      await loadDataMarts();
    } catch (error) {
      console.error('Error updating data mart:', error);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4" style={{ borderColor: '#007A3D', borderTopColor: 'transparent' }}></div>
          <p style={{ color: '#2E2E2E' }}>Loading data marts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: '#2E2E2E' }}>Data Mart Management</h1>
          <p className="text-gray-600">Manage data sources and connections</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium hover:opacity-90 transition-all"
          style={{ backgroundColor: '#007A3D' }}
        >
          <Plus className="w-4 h-4" />
          Add Data Mart
        </button>
      </div>

      {showForm && (
        <DataMartForm
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            loadDataMarts();
          }}
          createdBy={profile?.id || ''}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {dataMarts.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Database className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-600 mb-4">No data marts configured yet</p>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 rounded-lg text-white font-medium hover:opacity-90 transition-all"
              style={{ backgroundColor: '#007A3D' }}
            >
              Create Your First Data Mart
            </button>
          </div>
        ) : (
          dataMarts.map((mart) => (
            <DataMartCard
              key={mart.id}
              dataMart={mart}
              onToggleStatus={() => toggleDataMartStatus(mart.id, mart.is_active)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function DataMartCard({ dataMart, onToggleStatus }: { dataMart: DataMart; onToggleStatus: () => void }) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border hover:shadow-md transition-all" style={{ borderColor: '#E5E7EB' }}>
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: dataMart.is_active ? '#007A3D' : '#E5E7EB' }}>
          <Database className="w-6 h-6" style={{ color: dataMart.is_active ? '#FFFFFF' : '#9CA3AF' }} />
        </div>
        <button
          onClick={onToggleStatus}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          title={dataMart.is_active ? 'Deactivate' : 'Activate'}
        >
          {dataMart.is_active ? (
            <Power className="w-4 h-4" style={{ color: '#007A3D' }} />
          ) : (
            <PowerOff className="w-4 h-4 text-gray-400" />
          )}
        </button>
      </div>

      <h3 className="font-semibold text-lg mb-2" style={{ color: '#2E2E2E' }}>{dataMart.name}</h3>
      <p className="text-sm text-gray-600 mb-4 line-clamp-2">{dataMart.description || 'No description available'}</p>

      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Type</span>
          <span className="font-medium" style={{ color: '#2E2E2E' }}>{dataMart.database_type}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Status</span>
          <span
            className="px-2 py-1 rounded text-xs font-medium"
            style={{
              backgroundColor: dataMart.is_active ? '#007A3D' : '#E5E7EB',
              color: dataMart.is_active ? '#FFFFFF' : '#6B7280'
            }}
          >
            {dataMart.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      <div className="flex gap-2">
        <button className="flex-1 px-3 py-2 rounded-lg border hover:bg-gray-50 transition-colors text-sm font-medium" style={{ borderColor: '#E5E7EB', color: '#2E2E2E' }}>
          <Edit className="w-4 h-4 inline mr-1" />
          Edit
        </button>
        <button className="flex-1 px-3 py-2 rounded-lg border border-red-200 hover:bg-red-50 transition-colors text-sm font-medium text-red-600">
          <Trash2 className="w-4 h-4 inline mr-1" />
          Delete
        </button>
      </div>
    </div>
  );
}

function DataMartForm({ onClose, onSuccess, createdBy }: { onClose: () => void; onSuccess: () => void; createdBy: string }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [databaseType, setDatabaseType] = useState('postgresql');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('data_marts')
        .insert({
          name,
          description,
          database_type: databaseType,
          created_by: createdBy,
          is_active: true,
          schema_metadata: {},
        });

      if (error) throw error;
      onSuccess();
    } catch (error) {
      console.error('Error creating data mart:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full p-6">
        <h2 className="text-xl font-bold mb-4" style={{ color: '#2E2E2E' }}>Add New Data Mart</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: '#2E2E2E' }}>
              Data Mart Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2"
              style={{ borderColor: '#E5E7EB' }}
              placeholder="e.g., Retail Banking Data Mart"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: '#2E2E2E' }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 h-24"
              style={{ borderColor: '#E5E7EB' }}
              placeholder="Describe what data is available in this data mart"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: '#2E2E2E' }}>
              Database Type
            </label>
            <select
              value={databaseType}
              onChange={(e) => setDatabaseType(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2"
              style={{ borderColor: '#E5E7EB' }}
            >
              <option value="postgresql">PostgreSQL</option>
              <option value="mysql">MySQL</option>
              <option value="mssql">Microsoft SQL Server</option>
              <option value="oracle">Oracle</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border hover:bg-gray-50 transition-colors font-medium"
              style={{ borderColor: '#E5E7EB', color: '#2E2E2E' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 rounded-lg text-white font-medium hover:opacity-90 transition-all disabled:opacity-50"
              style={{ backgroundColor: '#007A3D' }}
            >
              {loading ? 'Creating...' : 'Create Data Mart'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
