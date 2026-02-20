
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getPublicMatchFromFirebase } from '../services/storageService.ts';
import { MatchState } from '../types.ts';
import { StatsView } from './StatsView.tsx';
import { Loader2, ArrowLeft } from 'lucide-react';

export const PublicMatchViewer: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [matchData, setMatchData] = useState<MatchState | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;
        const load = async () => {
            try {
                const data = await getPublicMatchFromFirebase(id);
                if (data) {
                    setMatchData(data);
                } else {
                    setError("No se enconntró el partido. Asegúrate de que el ID es correcto y que se ha sincronizado con la nube.");
                }
            } catch (err) {
                setError("Error cargando el partido.");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id]);

    if (loading) return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-900 text-white gap-4">
            <Loader2 className="animate-spin" size={48} />
            <p className="text-slate-400 animate-pulse">Cargando Estadísticas...</p>
        </div>
    );

    if (error) return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-900 text-red-400 font-bold gap-4 p-4 text-center">
            <p>{error}</p>
            <a href="/" className="text-handball-blue underline">Volver al Inicio</a>
        </div>
    );

    if (!matchData) return null;

    return (
        <div className="h-screen w-full flex flex-col bg-slate-900">
            <div className="bg-slate-800 p-4 border-b border-slate-700 flex items-center justify-between">
                <a href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-bold">
                    <ArrowLeft size={16} />
                    HANDBALL STATS PRO
                </a>
                <div className="text-xs text-slate-500 font-mono">
                    ID: {id?.substring(0, 8)}...
                </div>
            </div>
            <div className="flex-1 overflow-hidden relative">
                <StatsView
                    state={matchData}
                    onExportToExcel={() => { }}
                    onExportToTemplate={() => { }}
                    readOnly={true}
                />
            </div>
        </div>
    );
};
