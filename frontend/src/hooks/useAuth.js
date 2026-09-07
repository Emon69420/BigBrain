// Simple view router — no dep. Keeps org + auth in one place.
import { useState, useEffect } from "react";
import * as api from "../services/api.js";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const me = await api.me();
      setUser(me.user);
      setOrgs(me.orgs || []);
    } catch { setUser(null); setOrgs([]); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, []);

  async function login(email, password) {
    const u = await api.login(email, password);
    await refresh(); return u;
  }
  async function register(email, name, password) {
    const u = await api.register(email, name, password);
    await refresh(); return u;
  }
  async function logout() { await api.logout(); setUser(null); setOrgs([]); }

  return { user, orgs, loading, login, register, logout, refresh };
}
