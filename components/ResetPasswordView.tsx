import React, { useState } from 'react';
import { auth } from '../services/firebase';
import { confirmPasswordReset } from 'firebase/auth';
import { Loader2, ArrowLeft, Key } from 'lucide-react';
import { Toast } from '@capacitor/toast';

interface ResetPasswordViewProps {
    oobCode: string;
    onBack: () => void;
    onSuccess: () => void;
}

export const ResetPasswordView: React.FC<ResetPasswordViewProps> = ({ oobCode, onBack, onSuccess }) => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError("Las contraseñas no coinciden");
            return;
        }
        if (password.length < 6) {
            setError("La contraseña debe tener al menos 6 caracteres");
            return;
        }

        setLoading(true);
        setError(null);
        try {
            await confirmPasswordReset(auth, oobCode, password);
            await Toast.show({
                text: '✅ Contraseña actualizada correctamente',
                duration: 'long',
                position: 'top'
            });
            onSuccess();
        } catch (err: any) {
            console.error("Reset Password Error", err);
            setError(err.message || "Error al restablecer la contraseña");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col p-6 bg-slate-900 overflow-y-auto items-center justify-center">
            <div className="w-full max-w-md space-y-8">
                <div className="text-center">
                    <h2 className="text-3xl font-black text-white flex items-center justify-center gap-2">
                        <Key size={32} className="text-handball-blue" />
                        Nueva Contraseña
                    </h2>
                    <p className="text-slate-400 mt-2">Introduce tu nueva contraseña</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6 bg-slate-800 p-6 rounded-2xl border border-slate-700">
                    <div>
                        <label className="text-sm font-bold text-slate-300 uppercase block mb-2">Nueva Contraseña</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white focus:border-handball-blue outline-none transition-colors"
                            placeholder="Mínimo 6 caracteres"
                            required
                        />
                    </div>
                    <div>
                        <label className="text-sm font-bold text-slate-300 uppercase block mb-2">Confirmar Contraseña</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white focus:border-handball-blue outline-none transition-colors"
                            placeholder="Repite la contraseña"
                            required
                        />
                    </div>

                    {error && (
                        <div className="bg-red-900/20 border border-red-900/50 text-red-400 p-3 rounded-xl text-center text-sm font-bold animate-pulse">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 bg-handball-blue hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold uppercase tracking-wider transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : 'Restablecer Contraseña'}
                    </button>

                    <button type="button" onClick={onBack} className="w-full text-slate-500 hover:text-white text-sm font-bold py-2">
                        Cancelar
                    </button>
                </form>
            </div>
        </div>
    );
};
