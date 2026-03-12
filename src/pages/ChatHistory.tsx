import { useEffect, useState } from 'react';
import { MessageSquare, Calendar, Trash2 } from 'lucide-react';
import { supabase, ChatConversation } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function ChatHistory() {
  const { profile } = useAuth();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const { data } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('user_id', profile?.id)
        .order('updated_at', { ascending: false });

      setConversations(data || []);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteConversation = async (id: string) => {
    if (!confirm('Are you sure you want to delete this conversation?')) return;

    try {
      const { error } = await supabase
        .from('chat_conversations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadConversations();
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4" style={{ borderColor: '#007A3D', borderTopColor: 'transparent' }}></div>
          <p style={{ color: '#2E2E2E' }}>Loading conversations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2" style={{ color: '#2E2E2E' }}>Chat History</h1>
        <p className="text-gray-600">View and manage your previous conversations</p>
      </div>

      {conversations.length === 0 ? (
        <div className="text-center py-12">
          <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-600 mb-4">No conversations yet</p>
          <button
            onClick={() => window.location.hash = 'chat'}
            className="px-6 py-2 rounded-lg text-white font-medium hover:opacity-90 transition-all"
            style={{ backgroundColor: '#007A3D' }}
          >
            Start Your First Conversation
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              className="bg-white rounded-xl p-6 shadow-sm border hover:shadow-md transition-all"
              style={{ borderColor: '#E5E7EB' }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#007A3D' }}>
                  <MessageSquare className="w-6 h-6 text-white" />
                </div>
                <button
                  onClick={() => deleteConversation(conversation.id)}
                  className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                  title="Delete conversation"
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              </div>

              <h3 className="font-semibold text-lg mb-2 line-clamp-2" style={{ color: '#2E2E2E' }}>
                {conversation.title}
              </h3>

              <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                <Calendar className="w-4 h-4" />
                <span>{new Date(conversation.updated_at).toLocaleDateString()}</span>
              </div>

              <button
                onClick={() => {
                  window.location.hash = 'chat';
                  setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('loadConversation', { detail: conversation.id }));
                  }, 100);
                }}
                className="w-full px-4 py-2 rounded-lg border hover:bg-gray-50 transition-colors text-sm font-medium"
                style={{ borderColor: '#E5E7EB', color: '#007A3D' }}
              >
                Open Conversation
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
