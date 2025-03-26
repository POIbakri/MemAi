import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import type { PostgrestQueryBuilder } from '@supabase/postgrest-js';
import { Database } from '@/types/supabase';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { config } from './config';
import NetInfo from '@react-native-community/netinfo';

// Storage implementation for web
const webStorage = {
  getItem: (key: string) => {
    try {
      return Promise.resolve(localStorage.getItem(key));
    } catch (e) {
      return Promise.reject(e);
    }
  },
  setItem: (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
      return Promise.resolve();
    } catch (e) {
      return Promise.reject(e);
    }
  },
  removeItem: (key: string) => {
    try {
      localStorage.removeItem(key);
      return Promise.resolve();
    } catch (e) {
      return Promise.reject(e);
    }
  },
};

// For SecureStore, we need to add the missing removeItem method
const secureStorage = {
  getItem: SecureStore.getItemAsync,
  setItem: SecureStore.setItemAsync,
  removeItem: SecureStore.deleteItemAsync,
};

// Use appropriate storage based on platform
const storageAdapter = Platform.OS === 'web' ? webStorage : secureStorage;

// Create the Supabase client
export const supabase = createClient<Database>(
  config.supabase.url,
  config.supabase.anonKey,
  {
    auth: {
      storage: storageAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

// Export auth methods directly
export const auth = {
  getSession: () => supabase.auth.getSession(),
  signInWithPassword: (email: string, password: string) => 
    supabase.auth.signInWithPassword({ email, password }),
  signUp: (email: string, password: string) => 
    supabase.auth.signUp({ email, password }),
  signOut: () => supabase.auth.signOut(),
  onAuthStateChange: (callback: (event: any, session: any) => void) => 
    supabase.auth.onAuthStateChange(callback),
};

// Define the table types from your Database type
type Tables = Database['public']['Tables'];
type TableName = keyof Tables;

// Define the return type for each table
type TableReturnType<T extends TableName> = Tables[T]['Row'];

export const supabaseInterface = {
  from: (table: string) => {
    const query = supabase.from(table);
    return {
      select: (columns: string = '*') => query.select(columns),
      insert: (data: any) => query.insert(data),
      update: (data: any) => query.update(data),
      delete: () => query.delete(),
      eq: (column: string, value: any) => query.eq(column, value),
      neq: (column: string, value: any) => query.neq(column, value),
      gt: (column: string, value: any) => query.gt(column, value),
      gte: (column: string, value: any) => query.gte(column, value),
      lt: (column: string, value: any) => query.lt(column, value),
      lte: (column: string, value: any) => query.lte(column, value),
      like: (column: string, value: string) => query.like(column, value),
      ilike: (column: string, value: string) => query.ilike(column, value),
      in: (column: string, values: any[]) => query.in(column, values),
      order: (column: string, options?: { ascending?: boolean }) => 
        query.order(column, options),
      limit: (count: number) => query.limit(count),
      range: (from: number, to: number) => query.range(from, to),
    };
  },
  rpc: (fn: string, params: any) => supabase.rpc(fn, params),
};

// Export a method to get the actual client for advanced usage
export const getSupabaseClient = () => supabase;