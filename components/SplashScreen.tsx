import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
    onFinish: () => void;
    duration?: number; // Duration in milliseconds
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish, duration = 3000 }) => {
    const [fadeOut, setFadeOut] = useState(false);

    useEffect(() => {
        // Start fade out animation
        const fadeTimer = setTimeout(() => {
            setFadeOut(true);
        }, duration - 500); // Start fading 500ms before finish

        // Complete splash screen
        const finishTimer = setTimeout(() => {
            onFinish();
        }, duration);

        return () => {
            clearTimeout(fadeTimer);
            clearTimeout(finishTimer);
        };
    }, [duration, onFinish]);

    return (
        <div
            className={`fixed inset-0 z-[9999] flex items-center justify-center bg-[#0f1e33] transition-opacity duration-500 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}
            style={{
                backgroundImage: 'linear-gradient(135deg, #0f1e33 0%, #1a2942 100%)'
            }}
        >
            <div className="flex flex-col items-center justify-center w-full h-full">
                <img
                    src="/splash.png"
                    alt="HandballStats Pro"
                    className="max-w-full max-h-full object-contain"
                />
            </div>
        </div>
    );
};
