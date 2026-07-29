import React, { useState, useEffect } from 'react';
import { Database, Plus, Trash2, Search, BookOpen, FileCode, Landmark, Eye, X } from 'lucide-react';
import { getKnowledgeStore, saveKnowledgeAsset, deleteKnowledgeAsset, KnowledgeAsset, subscribeToStoreChanges } from '../../utils/evaluationStore';

export const RAGKnowledgeStore: React.FC = () => {
  const [assets, setAssets] = useState<KnowledgeAsset[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'answer-key' | 'rubric' | 'instructions'>('all');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<KnowledgeAsset | null>(null);

  // New Asset Form
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'answer-key' | 'rubric' | 'instructions'>('answer-key');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    const load = () => {
      setAssets(getKnowledgeStore());
    };
    load();
    return subscribeToStoreChanges(load);
  }, []);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !subject || !content) return;
    const newAsset = saveKnowledgeAsset({ title, type, subject, content });
    setAssets(prev => [newAsset, ...prev]);
    setIsAddOpen(false);
    
    // Reset Form
    setTitle('');
    setSubject('');
    setContent('');
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this asset? This is irreversible.')) {
      deleteKnowledgeAsset(id);
      setAssets(prev => prev.filter(a => a.id !== id));
      if (selectedAsset?.id === id) setSelectedAsset(null);
    }
  };

  const filteredAssets = assets.filter(a => {
    const matchesSearch = a.title.toLowerCase().includes(search.toLowerCase()) || 
                          a.subject.toLowerCase().includes(search.toLowerCase()) || 
                          a.content.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = typeFilter === 'all' || a.type === typeFilter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      {/* Top Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40 text-slate-500 dark:text-white" size={16} />
          <input 
            type="text" 
            placeholder="Search saved rubrics, answer keys, rules..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-2xl border border-black/5 dark:border-white/5">
            {(['all', 'answer-key', 'rubric', 'instructions'] as const).map(f => (
              <button
                key={f}
                onClick={() => setTypeFilter(f)}
                className={`px-4 py-2 rounded-xl text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer ${typeFilter === f ? 'bg-white dark:bg-slate-800 shadow-sm text-blue-500' : 'opacity-40 hover:opacity-100 text-slate-500 dark:text-white'}`}
              >
                {f === 'all' ? 'All' : f.replace('-', ' ')}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsAddOpen(true)}
            className="px-5 py-3 rounded-2xl bg-blue-500 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-blue-500/10 cursor-pointer hover:bg-blue-600 transition-all active:scale-95"
          >
            <Plus size={14} /> Add Asset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left List of Assets */}
        <div className="lg:col-span-2 space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
          {filteredAssets.length === 0 ? (
            <div className="text-center py-20 bg-slate-100/40 dark:bg-white/5 rounded-3xl border border-dashed border-black/10 dark:border-white/10">
              <Database className="mx-auto text-slate-400 dark:text-white/20 mb-4 animate-pulse" size={36} />
              <p className="text-sm font-semibold opacity-60">No knowledge assets found</p>
              <p className="text-xs opacity-40 mt-1">Upload a grading rubric or correct answer sheet reference to begin.</p>
            </div>
          ) : (
            filteredAssets.map(asset => (
              <div 
                key={asset.id}
                onClick={() => setSelectedAsset(asset)}
                className={`p-6 rounded-3xl cursor-pointer transition-all border ${selectedAsset?.id === asset.id ? 'bg-white dark:bg-slate-900 border-blue-500Shadow border-blue-500/50 shadow-lg' : 'bg-white dark:bg-slate-900/40 hover:bg-white/60 dark:hover:bg-slate-900/60 border-black/5 dark:border-white/5'}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${asset.type === 'answer-key' ? 'bg-emerald-500/10 text-emerald-500' : asset.type === 'rubric' ? 'bg-purple-500/10 text-purple-500' : 'bg-blue-500/10 text-blue-500'}`}>
                      {asset.type === 'answer-key' ? <FileCode size={20} /> : asset.type === 'rubric' ? <BookOpen size={20} /> : <Landmark size={20} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-slate-100 dark:bg-white/5 opacity-80">
                          {asset.type.replace('-', ' ')}
                        </span>
                        <span className="text-[10px] opacity-40 font-semibold">{asset.subject}</span>
                      </div>
                      <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white mt-1.5">{asset.title}</h3>
                    </div>
                  </div>
                  
                  <button 
                    onClick={(e) => handleDelete(asset.id, e)}
                    className="p-2 rounded-xl border border-black/5 dark:border-white/15 text-slate-400 hover:text-red-500 dark:hover:border-red-500/20 hover:bg-red-500/10 transition-all cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                
                <p className="mt-4 text-xs opacity-60 line-clamp-2 leading-relaxed">
                  {asset.content}
                </p>
                
                <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-[10px] opacity-40 font-bold uppercase tracking-wider">
                  <span>Saved to Vector Schema</span>
                  <span>{new Date(asset.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right Asset Inspection Panel */}
        <div className="lg:col-span-1">
          {selectedAsset ? (
            <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 shadow-xl space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-500">Asset Inspector</span>
                <button onClick={() => setSelectedAsset(null)} className="p-1 px-2.5 text-xs rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer">Close</button>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">{selectedAsset.subject}</span>
                <h3 className="text-2xl font-bold tracking-tight mt-1">{selectedAsset.title}</h3>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Content Reference Payload</label>
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-black/50 border border-black/5 dark:border-white/5 font-mono text-xs leading-relaxed max-h-[300px] overflow-y-auto whitespace-pre-wrap custom-scrollbar">
                  {selectedAsset.content}
                </div>
              </div>

              <div className="pt-4 border-t border-black/5 dark:border-white/5 space-y-2 text-xs opacity-60">
                <p><strong>Database System:</strong> Qdrant Cluster</p>
                <p><strong>Embeddings Metric:</strong> Cosine Similarity (dim: 1536)</p>
                <p><strong>Vector Status:</strong> Active & Indexed</p>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center rounded-3xl border border-dashed border-black/10 dark:border-white/15 h-full flex flex-col items-center justify-center py-20">
              <Eye className="text-slate-400 dark:text-white/20 mb-3" size={24} />
              <p className="text-xs font-semibold opacity-50">Select an asset to inspect vectors</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Asset Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-[210] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-xl w-full p-8 rounded-3xl bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 shadow-2xl space-y-6">
            <button 
              onClick={() => setIsAddOpen(false)}
              className="absolute right-6 top-6 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer"
            >
              <X size={18} />
            </button>

            <div>
              <h3 className="text-2xl font-black tracking-tight">SAVE KNOWLEDGE ASSET</h3>
              <p className="text-xs opacity-50 mt-1">Populate reference indexes to aid Gemini AI during real-time evaluations.</p>
            </div>

            <form onSubmit={handleCreate} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Asset Title</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. History Essay Rubric"
                    value={title} 
                    onChange={e => setTitle(e.target.value)}
                    className="w-full px-5 py-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Subject Course</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. Modern Hist v2"
                    value={subject} 
                    onChange={e => setSubject(e.target.value)}
                    className="w-full px-5 py-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Database Index Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['answer-key', 'rubric', 'instructions'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={`py-3.5 rounded-2xl text-[9px] font-bold uppercase tracking-widest transition-all border cursor-pointer ${type === t ? 'bg-blue-500 text-white border-blue-500' : 'bg-transparent text-slate-500 border-black/5 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'}`}
                    >
                      {t.replace('-', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Answer sheet/rubrics payload (pasted Text)</label>
                <textarea 
                  required
                  rows={6}
                  placeholder="Paste details of exam criteria / perfect solution schema..."
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  className="w-full px-5 py-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-xs leading-relaxed custom-scrollbar font-mono"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="flex-1 py-4 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-xs font-bold uppercase tracking-widest transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-4 rounded-2xl bg-blue-500 text-white hover:bg-blue-600 shadow-xl shadow-blue-500/10 text-xs font-bold uppercase tracking-widest transition-all cursor-pointer"
                >
                  Index Asset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
