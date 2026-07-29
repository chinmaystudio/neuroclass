import React, { useState, useRef } from 'react';
import { Rnd } from 'react-rnd';
import { 
  Type, 
  Image as ImageIcon, 
  Minus, 
  HelpCircle, 
  Plus, 
  Trash2, 
  Settings as SettingsIcon,
  Heading as HeadingIcon,
  BarChart2,
  List,
  Clock,
  Maximize2,
  AlertTriangle,
  Activity,
  Terminal,
  X,
  Move
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Test, LayoutModule, LayoutModuleType } from '../../types';

interface DesignerTabProps {
  test: Test;
  setTest: React.Dispatch<React.SetStateAction<Test>>;
}

const ToolboxItem = ({ type, icon: Icon, label, onClick }: { type: LayoutModuleType, icon: any, label: string, onClick: () => void }) => {
  return (
    <div 
      className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-indigo-400 hover:shadow-sm transition-all group dark:bg-slate-900 dark:border-slate-800"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors dark:bg-slate-800">
        <Icon size={18} />
      </div>
      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{label}</span>
      <div className="ml-auto opacity-0 group-hover:opacity-100 p-1 text-indigo-600">
        <Plus size={14} />
      </div>
    </div>
  );
};

const getContrastColor = (hex: string) => {
  if (!hex || hex.length < 7) return 'text-slate-900';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return yiq >= 128 ? 'text-slate-900' : 'text-white';
};

const getSecondaryColor = (hex: string) => {
  if (!hex || hex.length < 7) return 'text-slate-500';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return yiq >= 128 ? 'text-slate-500' : 'text-slate-400';
};

export default function DesignerTab({ test, setTest }: DesignerTabProps) {
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'elements' | 'editor' | 'settings'>('elements');
  const canvasRef = useRef<HTMLDivElement>(null);

  const textColor = getContrastColor(test.appearance.canvasBg);
  const secondaryColor = getSecondaryColor(test.appearance.canvasBg);

  const selectedModule = test.layout.find(m => m.id === selectedModuleId);

  // Auto-switch to editor when a module is selected
  React.useEffect(() => {
    if (selectedModuleId) setSidebarTab('editor');
  }, [selectedModuleId]);

  const addModule = (type: LayoutModuleType) => {
    const newId = uuidv4();
    const newModule: LayoutModule = { 
      id: newId, 
      type, 
      content: type === LayoutModuleType.Heading ? 'Section Title' : 
               type === LayoutModuleType.Text ? 'Enter description here...' : '',
      url: type === LayoutModuleType.Image ? 'https://images.unsplash.com/photo-1544391440-61b1f1396116?auto=format&fit=crop&q=80&w=1000' : undefined,
      position: { x: 100, y: 100 },
      size: { 
        width: type === LayoutModuleType.Heading || type === LayoutModuleType.Text || type === LayoutModuleType.Divider ? 600 : 300, 
        height: 'auto' 
      }
    };

    setTest(prev => ({ ...prev, layout: [...prev.layout, newModule] }));
    setSelectedModuleId(newId);
    setSidebarTab('editor');
  };

  const removeModule = (id: string) => {
    setTest(prev => ({ ...prev, layout: prev.layout.filter(m => m.id !== id) }));
    if (selectedModuleId === id) setSelectedModuleId(null);
  };

  const updateModule = (id: string, updates: Partial<LayoutModule>) => {
    setTest(prev => ({
      ...prev,
      layout: prev.layout.map(m => m.id === id ? { ...m, ...updates } : m)
    }));
  };

  const updateAppearance = (updates: Partial<Test['appearance']>) => {
    setTest(prev => ({
      ...prev,
      appearance: { ...prev.appearance, ...updates }
    }));
  };

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-0 -mx-10 -mt-2 overflow-hidden border-t border-slate-200 dark:border-slate-800">
      {/* Sidebar - Left */}
      <aside className={`transition-all duration-300 ease-in-out flex flex-col bg-slate-50 border-r border-slate-200 overflow-hidden dark:bg-slate-900/50 dark:border-slate-800 ${isSidebarCollapsed ? 'w-12' : 'w-80'}`}>
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          {!isSidebarCollapsed && (
            <div className="flex p-1 bg-slate-100 rounded-lg dark:bg-slate-800 w-full mr-4">
              <button 
                onClick={() => setSidebarTab('elements')}
                className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${sidebarTab === 'elements' ? 'bg-white shadow-sm text-indigo-600 dark:bg-slate-700' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <Plus size={12} /> Elements
              </button>
              <button 
                onClick={() => setSidebarTab('editor')}
                className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${sidebarTab === 'editor' ? 'bg-white shadow-sm text-indigo-600 dark:bg-slate-700' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <SettingsIcon size={12} /> Editor
              </button>
              <button 
                onClick={() => setSidebarTab('settings')}
                className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${sidebarTab === 'settings' ? 'bg-white shadow-sm text-indigo-600 dark:bg-slate-700' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <Maximize2 size={12} /> Canvas
              </button>
            </div>
          )}
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-1.5 hover:bg-slate-200 rounded-md transition-colors dark:hover:bg-slate-800"
          >
            {isSidebarCollapsed ? <Plus size={16} /> : <Minus size={16} />}
          </button>
        </div>
        
        {!isSidebarCollapsed && (
          <div className="flex-1 overflow-y-auto p-5 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
            {sidebarTab === 'elements' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Base Elements</h3>
                  <div className="grid grid-cols-1 gap-2">
                    <ToolboxItem type={LayoutModuleType.Heading} icon={HeadingIcon} label="Heading" onClick={() => addModule(LayoutModuleType.Heading)} />
                    <ToolboxItem type={LayoutModuleType.Text} icon={Type} label="Paragraph" onClick={() => addModule(LayoutModuleType.Text)} />
                    <ToolboxItem type={LayoutModuleType.Image} icon={ImageIcon} label="Media Block" onClick={() => addModule(LayoutModuleType.Image)} />
                    <ToolboxItem type={LayoutModuleType.Divider} icon={Minus} label="Divider Line" onClick={() => addModule(LayoutModuleType.Divider)} />
                  </div>
                </div>

                <div>
                   <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Test Modules</h3>
                   <div className="grid grid-cols-1 gap-2">
                      <ToolboxItem type={LayoutModuleType.QuestionBox} icon={HelpCircle} label="Question Area" onClick={() => addModule(LayoutModuleType.QuestionBox)} />
                      <ToolboxItem type={LayoutModuleType.StatsBox} icon={BarChart2} label="Attempt Tracker" onClick={() => addModule(LayoutModuleType.StatsBox)} />
                      <ToolboxItem type={LayoutModuleType.SectionNav} icon={List} label="Section Selector" onClick={() => addModule(LayoutModuleType.SectionNav)} />
                      <ToolboxItem type={LayoutModuleType.Timer} icon={Clock} label="Exam Timer" onClick={() => addModule(LayoutModuleType.Timer)} />
                      <ToolboxItem type={LayoutModuleType.Alert} icon={AlertTriangle} label="Alert Box" onClick={() => addModule(LayoutModuleType.Alert)} />
                      <ToolboxItem type={LayoutModuleType.Progress} icon={Activity} label="Step Progress" onClick={() => addModule(LayoutModuleType.Progress)} />
                      <ToolboxItem type={LayoutModuleType.SystemLog} icon={Terminal} label="System Log" onClick={() => addModule(LayoutModuleType.SystemLog)} />
                   </div>
                </div>
              </div>
            )}

            {sidebarTab === 'editor' && (
              <div className="space-y-6">
                {!selectedModule ? (
                  <div className="py-12 text-center space-y-4">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-300 dark:bg-slate-800">
                      <SettingsIcon size={24} />
                    </div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Select an element<br/>on the canvas</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl dark:bg-indigo-900/20 dark:border-indigo-900/50">
                      <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Now Editing:</p>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300 capitalize">{selectedModule.type.replace('-', ' ')}</p>
                    </div>

                    {(selectedModule.type === LayoutModuleType.Heading || 
                      selectedModule.type === LayoutModuleType.Text ||
                      selectedModule.type === LayoutModuleType.Alert) && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-slate-400 block">Content Text</label>
                          <textarea 
                            value={selectedModule.content}
                            onChange={(e) => updateModule(selectedModule.id, { content: e.target.value })}
                            className="w-full bg-slate-100 border-none rounded-xl p-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:bg-slate-800 dark:text-slate-200"
                            rows={selectedModule.type === LayoutModuleType.Heading ? 3 : 10}
                            placeholder="Type here..."
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-400 block">Text Color</label>
                            <input 
                              type="color"
                              value={selectedModule.style?.textColor || (getContrastColor(test.appearance.canvasBg) === 'text-white' ? '#ffffff' : '#0f172a')}
                              onChange={(e) => updateModule(selectedModule.id, { 
                                style: { ...selectedModule.style, textColor: e.target.value } 
                              })}
                              className="w-full h-10 rounded-lg cursor-pointer bg-slate-100 dark:bg-slate-800 border-none p-1"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-400 block">Bg Color</label>
                            <input 
                              type="color"
                              value={selectedModule.style?.backgroundColor || '#ffffff'}
                              onChange={(e) => updateModule(selectedModule.id, { 
                                style: { ...selectedModule.style, backgroundColor: e.target.value } 
                              })}
                              className="w-full h-10 rounded-lg cursor-pointer bg-slate-100 dark:bg-slate-800 border-none p-1"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-slate-400 block">Font Size (px)</label>
                          <input 
                            type="number"
                            value={parseInt(selectedModule.style?.fontSize || (selectedModule.type === LayoutModuleType.Heading ? '30' : '16'))}
                            onChange={(e) => updateModule(selectedModule.id, { 
                              style: { ...selectedModule.style, fontSize: `${e.target.value}px` } 
                            })}
                            className="w-full bg-slate-100 border-none rounded-xl p-2.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:bg-slate-800 dark:text-slate-200"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-slate-400 block">Alignment</label>
                          <div className="flex bg-slate-100 rounded-xl p-1 dark:bg-slate-800">
                            {(['left', 'center', 'right'] as const).map((align) => (
                              <button
                                key={align}
                                onClick={() => updateModule(selectedModule.id, { 
                                  style: { ...selectedModule.style, textAlign: align } 
                                })}
                                className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                  (selectedModule.style?.textAlign || 'left') === align 
                                    ? 'bg-white shadow-sm text-indigo-600 dark:bg-slate-700' 
                                    : 'text-slate-400 hover:text-slate-600'
                                }`}
                              >
                                {align}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedModule.type === LayoutModuleType.Image && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 block">Image URL</label>
                        <input 
                          value={selectedModule.url}
                          onChange={(e) => updateModule(selectedModule.id, { url: e.target.value })}
                          className="w-full bg-slate-100 border-none rounded-xl p-4 text-xs font-mono focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:bg-slate-800 dark:text-slate-200"
                        />
                      </div>
                    )}

                    <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                      <button 
                        onClick={() => removeModule(selectedModule.id)}
                        className="w-full py-3 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-colors"
                      >
                        Delete Module
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {sidebarTab === 'settings' && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">Canvas Background</label>
                    <div className="flex flex-wrap gap-2">
                      {['#f8fafc', '#ffffff', '#111827', '#eef2ff', '#f0f9ff', '#fff7ed'].map(color => (
                        <button 
                          key={color}
                          onClick={() => updateAppearance({ canvasBg: color })}
                          className={`w-7 h-7 rounded-sm border-2 border-white shadow-sm transition-all ${test.appearance.canvasBg === color ? 'scale-110 ring-2 ring-indigo-500' : 'hover:scale-105'}`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">Global Font</label>
                    <select 
                      value={test.appearance.fontFamily}
                      onChange={(e) => updateAppearance({ fontFamily: e.target.value })}
                      className="w-full bg-slate-100 border-none rounded-xl p-3 text-xs font-bold uppercase tracking-widest focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:bg-slate-800 dark:text-slate-200"
                    >
                       <option value="Inter">Inter</option>
                       <option value="Space Grotesk">Grotesk</option>
                       <option value="JetBrains Mono">Mono</option>
                       <option value="Playfair Display">Serif</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </aside>

      {/* Canvas - Main Area */}
      <main 
        className="flex-1 relative overflow-hidden bg-slate-200/50 p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) setSelectedModuleId(null);
        }}
      >
        <div 
          ref={canvasRef}
          className="w-full h-full relative overflow-auto shadow-2xl transition-colors duration-500 border border-slate-300 rounded-sm"
          style={{ backgroundColor: test.appearance.canvasBg }}
        >
          {/* Grid lines for visual aid */}
          <div className="absolute inset-0 pointer-events-none opacity-5" style={{ 
            backgroundImage: 'radial-gradient(#000 1px, transparent 1px)',
            backgroundSize: '20px 20px'
          }} />

          {test.layout.map((module) => (
            <Rnd
              key={module.id}
              size={{ width: module.size.width, height: module.size.height }}
              position={{ x: module.position.x, y: module.position.y }}
              onDragStop={(e, d) => {
                updateModule(module.id, { position: { x: d.x, y: d.y } });
              }}
              onResizeStop={(e, direction, ref, delta, position) => {
                updateModule(module.id, {
                  size: { width: ref.style.width, height: ref.style.height },
                  position: { x: position.x, y: position.y }
                });
              }}
              bounds="parent"
              enableResizing={{
                bottomRight: true,
                bottom: true,
                right: true,
                topLeft: true,
                top: true,
                left: true,
                topRight: true,
                bottomLeft: true
              }}
              onMouseDown={() => setSelectedModuleId(module.id)}
              className={`group ${selectedModuleId === module.id ? 'z-50' : 'z-10'}`}
              dragHandleClassName="drag-handle"
            >
              <div 
                className={`relative w-full h-full p-4 transition-all ${
                  selectedModuleId === module.id 
                    ? 'ring-2 ring-indigo-500 bg-white/40 backdrop-blur-sm' 
                    : 'hover:ring-1 hover:ring-slate-300'
                }`}
              >
                {/* Drag Handle */}
                <div className={`drag-handle absolute -top-3 -left-3 p-1.5 bg-indigo-600 text-white rounded-lg shadow-lg cursor-move opacity-0 group-hover:opacity-100 transition-opacity z-20 ${selectedModuleId === module.id ? 'opacity-100' : ''}`}>
                   <Move size={14} />
                </div>

                {/* Delete button toggle */}
                {selectedModuleId === module.id && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); removeModule(module.id); }}
                    className="absolute -top-3 -right-3 p-1.5 bg-red-500 text-white rounded-lg shadow-lg hover:bg-red-600 transition-colors z-20"
                  >
                    <Trash2 size={14} />
                  </button>
                )}

                {/* Module Previews */}
                <div className="w-full h-full overflow-hidden">
                  {module.type === LayoutModuleType.Heading && (
                    <h2 
                      style={{ 
                        color: module.style?.textColor,
                        fontSize: module.style?.fontSize,
                        textAlign: module.style?.textAlign
                      }}
                      className={`text-3xl font-black tracking-tight leading-tight ${!module.style?.textColor ? textColor : ''}`}
                    >
                      {module.content || 'Section Header'}
                    </h2>
                  )}
                  {module.type === LayoutModuleType.Text && (
                    <p 
                      style={{ 
                        color: module.style?.textColor,
                        fontSize: module.style?.fontSize,
                        textAlign: module.style?.textAlign
                      }}
                      className={`text-base leading-relaxed ${!module.style?.textColor ? secondaryColor : ''}`}
                    >
                      {module.content || 'Edit text content...'}
                    </p>
                  )}
                  {module.type === LayoutModuleType.Image && (
                    <div className="w-full h-full bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
                      <img src={module.url} alt="Media" className="w-full h-full object-cover" />
                    </div>
                  )}
                  {module.type === LayoutModuleType.Divider && (
                    <div className="h-0.5 bg-slate-200 w-full dark:bg-slate-800 my-auto" />
                  )}
                  {module.type === LayoutModuleType.QuestionBox && (
                    <div className="w-full h-full min-h-[100px] border-2 border-indigo-100 bg-indigo-50/20 rounded-2xl border-dashed flex flex-col items-center justify-center gap-2">
                       <HelpCircle className="text-indigo-500" size={24} />
                       <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest text-center">Question Content</span>
                    </div>
                  )}
                  {module.type === LayoutModuleType.StatsBox && (
                    <div className="w-full h-full min-h-[80px] grid grid-cols-2 bg-slate-50/80 border border-slate-200 rounded-xl dark:bg-slate-800/50">
                       <div className="flex flex-col items-center justify-center border-r border-slate-200">
                          <span className="text-lg font-black text-indigo-600">--</span>
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Done</span>
                       </div>
                       <div className="flex flex-col items-center justify-center">
                          <span className="text-lg font-black text-slate-400">--</span>
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Left</span>
                       </div>
                    </div>
                  )}
                  {module.type === LayoutModuleType.Timer && (
                    <div className="w-full h-full min-h-[60px] flex items-center justify-center gap-3 bg-slate-900 rounded-xl text-white shadow-xl px-4">
                       <Clock size={16} className="text-indigo-500" />
                       <div className="text-lg font-black font-mono tracking-tighter">00:00:00</div>
                    </div>
                  )}
                  {module.type === LayoutModuleType.SectionNav && (
                    <div className="flex gap-1 overflow-hidden h-full items-center">
                       {[1, 2, 3].map(i => (
                         <div key={i} className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${i === 1 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                           S{i}
                         </div>
                       ))}
                    </div>
                  )}
                  {module.type === LayoutModuleType.Alert && (
                    <div 
                      style={{ 
                        backgroundColor: module.style?.backgroundColor || 'rgb(255 251 235)',
                        borderColor: module.style?.backgroundColor ? 'transparent' : 'rgb(251 191 36 / 0.2)'
                      }}
                      className="flex items-start gap-3 p-3 border rounded-xl h-full overflow-hidden"
                    >
                       <AlertTriangle className="text-amber-600 shrink-0" size={16} />
                       <p 
                         style={{ 
                           color: module.style?.textColor,
                           fontSize: module.style?.fontSize,
                           textAlign: module.style?.textAlign
                         }}
                         className={`text-[10px] leading-tight font-bold ${!module.style?.textColor ? 'text-amber-700' : ''}`}
                       >
                         {module.content || 'Alert Message'}
                       </p>
                    </div>
                  )}
                  {module.type === LayoutModuleType.Progress && (
                    <div className="space-y-1 w-full flex flex-col justify-center h-full">
                       <div className="flex justify-between items-center px-1">
                          <span className={`text-[8px] font-black uppercase tracking-tighter ${secondaryColor}`}>Total Progress</span>
                          <span className="text-[8px] font-black text-indigo-600">35%</span>
                       </div>
                       <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-600 w-[35%] rounded-full shadow-sm" />
                       </div>
                    </div>
                  )}
                  {module.type === LayoutModuleType.SystemLog && (
                    <div className="bg-slate-900 rounded-xl p-3 font-mono text-[8px] text-emerald-400 border border-slate-800 h-full overflow-hidden">
                       <div className="opacity-40 mb-1 flex items-center gap-1 border-b border-white/5 pb-1"><Terminal size={10}/> LOG</div>
                       <div className="truncate">&gt; Secure session active</div>
                       <div className="truncate">&gt; Proctored environment</div>
                    </div>
                  )}
                </div>
              </div>
            </Rnd>
          ))}
        </div>
      </main>
    </div>
  );
}
