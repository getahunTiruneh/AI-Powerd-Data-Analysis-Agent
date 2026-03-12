import { useState, useEffect, useRef } from 'react';
import { Send, Database, Plus, Sparkles } from 'lucide-react';
import { supabase, DataMart, ChatConversation, ChatMessage } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function AIChat() {
  const { profile } = useAuth();
  const [dataMarts, setDataMarts] = useState<DataMart[]>([]);
  const [selectedDataMart, setSelectedDataMart] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadDataMarts();
    loadConversations();
  }, []);

  useEffect(() => {
    if (currentConversation) {
      loadMessages(currentConversation);
    }
  }, [currentConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadDataMarts = async () => {
    try {
      const { data: accessData } = await supabase
        .from('user_data_mart_access')
        .select('data_mart_id')
        .eq('user_id', profile?.id);

      if (!accessData || accessData.length === 0) {
        const { data: allMarts } = await supabase
          .from('data_marts')
          .select('*')
          .eq('is_active', true);
        setDataMarts(allMarts || []);
        return;
      }

      const martIds = accessData.map((a) => a.data_mart_id);
      const { data } = await supabase
        .from('data_marts')
        .select('*')
        .in('id', martIds)
        .eq('is_active', true);

      setDataMarts(data || []);
    } catch (error) {
      console.error('Error loading data marts:', error);
    }
  };

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
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      setMessages(data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const createNewConversation = async () => {
    if (!selectedDataMart) {
      alert('Please select a data mart first');
      return;
    }

    try {
      const { data } = await supabase
        .from('chat_conversations')
        .insert({
          user_id: profile?.id,
          data_mart_id: selectedDataMart,
          title: 'New Conversation',
        })
        .select()
        .single();

      if (data) {
        setCurrentConversation(data.id);
        setMessages([]);
        await loadConversations();
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || !currentConversation) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);

    try {
      const { data: userMsg } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: currentConversation,
          role: 'user',
          content: userMessage,
        })
        .select()
        .single();

      if (userMsg) {
        setMessages((prev) => [...prev, userMsg]);
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const aiResponse = generateMockResponse(userMessage);

      const { data: aiMsg } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: currentConversation,
          role: 'assistant',
          content: aiResponse,
          query_type: 'data_query',
        })
        .select()
        .single();

      if (aiMsg) {
        setMessages((prev) => [...prev, aiMsg]);
      }

      const conversation = conversations.find((c) => c.id === currentConversation);
      if (conversation && conversation.title === 'New Conversation') {
        await supabase
          .from('chat_conversations')
          .update({ title: userMessage.slice(0, 50) + '...' })
          .eq('id', currentConversation);
        await loadConversations();
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateMockResponse = (query: string): string => {
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('loan') || lowerQuery.includes('credit')) {
      return 'Based on the Retail Banking Data Mart, here are the loan statistics:\n\n• Total active loans: 45,234\n• Average loan amount: ETB 125,000\n• Loan growth rate: +12.5% YoY\n• Default rate: 2.3%\n\nWould you like me to provide more detailed analysis or segment this by region?';
    }

    if (lowerQuery.includes('deposit') || lowerQuery.includes('savings')) {
      return 'Here\'s a summary of deposit data:\n\n• Total deposits: ETB 125.4B\n• Number of accounts: 2.3M\n• Average deposit: ETB 54,500\n• Month-over-month growth: +3.2%\n\nThe strongest growth is in savings accounts, particularly in urban areas.';
    }

    if (lowerQuery.includes('branch') || lowerQuery.includes('region')) {
      return 'Regional performance analysis:\n\n• Addis Ababa: 45% of total transactions\n• Oromia: 22% of total transactions\n• Amhara: 15% of total transactions\n• Other regions: 18%\n\nThe capital region continues to lead in digital banking adoption.';
    }

    return 'I\'ve analyzed your query against the selected data mart. Here are the key findings:\n\n• Data is available for the requested period\n• No anomalies detected\n• Trends show consistent growth patterns\n\nThis is a demo response. In production, this would be generated by an AI model connected to your actual data sources. Would you like to explore any specific aspect in more detail?';
  };

  return (
    <div className="flex h-full">
      <div className="w-80 border-r flex flex-col" style={{ borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' }}>
        <div className="p-4 border-b" style={{ borderColor: '#E5E7EB' }}>
          <button
            onClick={createNewConversation}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-white font-medium hover:opacity-90 transition-all"
            style={{ backgroundColor: '#007A3D' }}
          >
            <Plus className="w-4 h-4" />
            New Conversation
          </button>
        </div>

        <div className="p-4 border-b" style={{ borderColor: '#E5E7EB' }}>
          <label className="block text-sm font-medium mb-2" style={{ color: '#2E2E2E' }}>
            Select Data Mart
          </label>
          <select
            value={selectedDataMart || ''}
            onChange={(e) => setSelectedDataMart(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-sm"
            style={{ borderColor: '#E5E7EB' }}
          >
            <option value="">Choose a data mart...</option>
            {dataMarts.map((mart) => (
              <option key={mart.id} value={mart.id}>
                {mart.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-3 text-gray-500">Recent Conversations</h3>
          {conversations.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No conversations yet</p>
          ) : (
            <div className="space-y-2">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setCurrentConversation(conv.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                    currentConversation === conv.id
                      ? 'text-white'
                      : 'hover:bg-gray-100'
                  }`}
                  style={currentConversation === conv.id ? { backgroundColor: '#007A3D' } : { color: '#2E2E2E' }}
                >
                  <p className="font-medium truncate">{conv.title}</p>
                  <p className={`text-xs mt-1 ${currentConversation === conv.id ? 'text-white/70' : 'text-gray-500'}`}>
                    {new Date(conv.updated_at).toLocaleDateString()}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col" style={{ backgroundColor: '#F5F7F6' }}>
        {!currentConversation ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center max-w-md">
              <div className="w-20 h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center" style={{ backgroundColor: '#007A3D' }}>
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-3" style={{ color: '#2E2E2E' }}>
                Welcome to CBE AI Assistant
              </h2>
              <p className="text-gray-600 mb-6">
                Ask questions about your data in natural language. Select a data mart and start a new conversation to begin.
              </p>
              <div className="grid grid-cols-1 gap-3 text-left">
                <div className="p-4 rounded-lg border" style={{ borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' }}>
                  <p className="text-sm font-medium mb-1" style={{ color: '#007A3D' }}>Example Query</p>
                  <p className="text-sm text-gray-600">"Show total retail loan growth for the last 12 months"</p>
                </div>
                <div className="p-4 rounded-lg border" style={{ borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' }}>
                  <p className="text-sm font-medium mb-1" style={{ color: '#007A3D' }}>Example Query</p>
                  <p className="text-sm text-gray-600">"Compare digital banking users by region"</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-3xl mx-auto space-y-6">
                {messages.length === 0 ? (
                  <div className="text-center py-12">
                    <Database className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-gray-600">Start asking questions about your data</p>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-4 ${message.role === 'user' ? 'justify-end' : ''}`}
                    >
                      {message.role === 'assistant' && (
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#007A3D' }}>
                          <Sparkles className="w-5 h-5 text-white" />
                        </div>
                      )}
                      <div
                        className={`rounded-xl px-4 py-3 max-w-2xl ${
                          message.role === 'user'
                            ? 'text-white'
                            : 'bg-white border'
                        }`}
                        style={
                          message.role === 'user'
                            ? { backgroundColor: '#007A3D' }
                            : { borderColor: '#E5E7EB' }
                        }
                      >
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      </div>
                      {message.role === 'user' && (
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#CFAE3D' }}>
                          <span className="text-sm font-bold" style={{ color: '#005B2E' }}>
                            {profile?.full_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="border-t p-4" style={{ borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' }}>
              <div className="max-w-3xl mx-auto">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !loading && handleSendMessage()}
                    placeholder="Ask a question about your data..."
                    disabled={loading}
                    className="flex-1 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 disabled:opacity-50"
                    style={{ borderColor: '#E5E7EB' }}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={loading || !input.trim()}
                    className="px-6 py-3 rounded-lg text-white font-medium hover:opacity-90 transition-all disabled:opacity-50"
                    style={{ backgroundColor: '#007A3D' }}
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  AI responses are generated based on your selected data mart
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
