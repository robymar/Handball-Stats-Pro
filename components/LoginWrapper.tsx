
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LoginView } from './LoginView.tsx';

export const LoginWrapper: React.FC = () => {
    const navigate = useNavigate();
    return (
        <LoginView
            onBack={() => navigate('/')}
            onLoginSuccess={() => navigate('/cloud')}
            onViewCloudMatches={() => navigate('/cloud')}
        />
    );
};
