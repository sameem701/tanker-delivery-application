import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [userToken, setUserToken] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const login = async (token, role, id) => {
    setUserToken(token);
    setUserRole(role);
    setUserId(id);
    await AsyncStorage.setItem('userToken', token);
    await AsyncStorage.setItem('userRole', role);
    await AsyncStorage.setItem('userId', id.toString());
  };

  const logout = async () => {
    setUserToken(null);
    setUserRole(null);
    setUserId(null);
    await AsyncStorage.removeItem('userToken');
    await AsyncStorage.removeItem('userRole');
    await AsyncStorage.removeItem('userId');
  };

  const verifySession = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const role = await AsyncStorage.getItem('userRole');
      const id = await AsyncStorage.getItem('userId');

      if (token && role && id) {
        // Mock successful verify
        await login(token, role, id);
      } else {
        await logout();
      }
    } catch (error) {
      console.log('Session verification error:', error);
      await logout();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    verifySession();
  }, []);

  return (
    <AuthContext.Provider value={{
      userToken, userRole, userId, isLoading, login, logout, verifySession, setUserRole
    }}>
      {children}
    </AuthContext.Provider>
  );
};
