import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import { 
  Pill, Calendar, AlertTriangle, CheckCircle, 
  PlusCircle, MinusCircle, RefreshCw, BarChart2, History, 
  ArrowUpRight, ArrowDownRight, Trash2, Download, LogIn, LogOut, User, ShieldCheck,
  Eye, EyeOff, Globe, UserPlus, Users
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function App() {
  const API_URL = process.env.REACT_APP_API_URL || 'https://smart-medicine-forecasting.onrender.com';

  // Authentification
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('pharma_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Login
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loadingLogin, setLoadingLogin] = useState(false);

  // Données
  const [medicaments, setMedicaments] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [mouvements, setMouvements] = useState([]);

  // Gestion des Utilisateurs (SuperAdmin)
  const [usersList, setUsersList] = useState([]);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('admin_pharmacie');
  const [loadingCreateUser, setLoadingCreateUser] = useState(false);

  // IA
  const [selectedMed, setSelectedMed] = useState('');
  const [mois, setMois] = useState(1);
  const [prediction, setPrediction] = useState(null);
  const [loadingPredict, setLoadingPredict] = useState(false);

  // Entrées / Sorties
  const [entreeMed, setEntreeMed] = useState('');
  const [quantiteEntree, setQuantiteEntree] = useState(10);
  const [loadingEntree, setLoadingEntree] = useState(false);

  const [sortieMed, setSortieMed] = useState('');
  const [quantiteSortie, setQuantiteSortie] = useState(5);
  const [loadingSortie, setLoadingSortie] = useState(false);

  useEffect(() => {
    if (currentUser) {
      fetchInitialData();
      if (currentUser.role === 'superadmin') {
        fetchUsers();
      }
    }
  }, [currentUser]);

  const fetchInitialData = async () => {
    try {
      const [medsRes, stocksRes, mouvementsRes] = await Promise.all([
        axios.get(`${API_URL}/medicaments`),
        axios.get(`${API_URL}/stocks`),
        axios.get(`${API_URL}/mouvements`)
      ]);
      
      const meds = medsRes.data || [];
      setMedicaments(meds);
      setStocks(stocksRes.data || []);
      setMouvements(mouvementsRes.data || []);

      if (meds.length > 0) {
        setSelectedMed(meds[0].id);
        setEntreeMed(meds[0].id);
        setSortieMed(meds[0].id);
      }
    } catch (err) {
      console.error("Erreur de chargement des données:", err);
      toast.error("Erreur lors de la récupération des données");
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API_URL}/utilisateurs`);
      setUsersList(res.data || []);
    } catch (err) {
      console.error("Erreur de chargement des utilisateurs:", err);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoadingLogin(true);
    try {
      const res = await axios.post(`${API_URL}/login`, {
        username: usernameInput,
        password: passwordInput
      });

      const userData = {
        username: res.data.username,
        role: res.data.role
      };

      setCurrentUser(userData);
      localStorage.setItem('pharma_user', JSON.stringify(userData));
      toast.success(`Bienvenue, ${res.data.username} !`);
    } catch (err) {
      console.error("Erreur de connexion:", err);
      toast.error("Identifiants incorrects ou serveur indisponible");
    } finally {
      setLoadingLogin(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('pharma_user');
    setPrediction(null);
    toast.success("Déconnexion réussie");
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setLoadingCreateUser(true);
    try {
      await axios.post(`${API_URL}/utilisateurs`, {
        username: newUsername,
        password: newPassword,
        role: newRole
      });
      toast.success("Nouvel utilisateur créé avec succès !");
      setNewUsername('');
      setNewPassword('');
      fetchUsers();
    } catch (err) {
      console.error("Erreur création utilisateur:", err);
      toast.error(err.response?.data?.detail || "Erreur lors de la création de l'utilisateur");
    } finally {
      setLoadingCreateUser(false);
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (window.confirm(`Supprimer le compte "${username}" ?`)) {
      try {
        await axios.delete(`${API_URL}/utilisateurs/${userId}`);
        toast.success("Utilisateur supprimé !");
        fetchUsers();
      } catch (err) {
        console.error("Erreur suppression utilisateur:", err);
        toast.error(err.response?.data?.detail || "Erreur lors de la suppression");
      }
    }
  };

  const refreshStocksAndHistory = async () => {
    try {
      const [resStocks, resMouvements] = await Promise.all([
        axios.get(`${API_URL}/stocks`),
        axios.get(`${API_URL}/mouvements`)
      ]);
      setStocks(resStocks.data || []);
      setMouvements(resMouvements.data || []);
      toast.success("Données actualisées !");
    } catch (err) {
      console.error("Erreur de rafraîchissement:", err);
      toast.error("Échec de l'actualisation");
    }
  };

  const exportToCSV = () => {
    if (mouvements.length === 0) {
      toast.error("Aucun mouvement à exporter");
      return;
    }

    const headers = ["ID", "Date et Heure", "Type", "Medicament", "Quantite"];
    const rows = mouvements.map(m => [
      m.id,
      `"${new Date(m.date_mouvement).toLocaleString('fr-FR')}"`,
      m.type_mouvement,
      `"${m.medicament}"`,
      m.type_mouvement === 'ENTREE' ? `+${m.quantite}` : `-${m.quantite}`
    ]);

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map(e => e.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    
    link.setAttribute("href", url);
    link.setAttribute("download", `historique_mouvements_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Export CSV téléchargé !");
  };

  const handleClearHistory = async () => {
    if (window.confirm("Voulez-vous vraiment supprimer tout l'historique des mouvements ?")) {
      try {
        await axios.delete(`${API_URL}/mouvements`);
        setMouvements([]);
        toast.success("Historique effacé avec succès");
      } catch (err) {
        console.error("Erreur lors de la suppression:", err);
        toast.error("Erreur lors de la suppression");
      }
    }
  };

  const handlePredict = async (e) => {
    e.preventDefault();
    setLoadingPredict(true);
    try {
      const resPredict = await axios.post(`${API_URL}/predict`, {
        medicament_id: Number(selectedMed),
        mois: Number(mois)
      });
      setPrediction(resPredict.data.quantite_prevue);
      toast.success("Prévision calculée !");
    } catch (err) {
      console.error("Erreur de prédiction:", err);
      toast.error("Erreur lors du calcul de prévision");
    } finally {
      setLoadingPredict(false);
    }
  };

  const handleEntreeSubmit = async (e) => {
    e.preventDefault();
    setLoadingEntree(true);
    try {
      await axios.post(`${API_URL}/stocks/mouvement`, {
        medicament_id: Number(entreeMed),
        quantite_ajoutee: Number(quantiteEntree)
      });
      await refreshStocksAndHistory();
      toast.success("Stock ajouté avec succès !");
    } catch (err) {
      console.error("Erreur entrée stock:", err);
      toast.error("Erreur lors de l'ajout au stock");
    } finally {
      setLoadingEntree(false);
    }
  };

  const handleSortieSubmit = async (e) => {
    e.preventDefault();
    setLoadingSortie(true);
    try {
      await axios.post(`${API_URL}/stocks/mouvement`, {
        medicament_id: Number(sortieMed),
        quantite_ajoutee: -Number(quantiteSortie)
      });
      await refreshStocksAndHistory();
      toast.success("Stock retiré avec succès !");
    } catch (err) {
      console.error("Erreur sortie stock:", err);
      toast.error("Erreur lors du retrait de stock");
    } finally {
      setLoadingSortie(false);
    }
  };

  const chartData = (stocks || []).map(item => ({
    nom: item.medicament,
    "Stock Réel": item.quantite_disponible,
    "Seuil Alerte": item.seuil_alerte
  }));

  // PAGE LOGIN
  if (!currentUser) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Segoe UI', Roboto, sans-serif", backgroundColor: '#ffffff' }}>
        <Toaster position="top-right" />

        {/* CÔTÉ GAUCHE */}
        <div style={{
          flex: '1.1',
          backgroundImage: 'linear-gradient(135deg, rgba(4, 120, 87, 0.88), rgba(6, 78, 59, 0.92)), url("https://images.unsplash.com/photo-1586015555751-63bb77f4322a?q=80&w=1200&auto=format&fit=crop")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          padding: '50px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          color: '#ffffff',
          boxSizing: 'border-box'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '8px' }}>
              <div style={{ backgroundColor: '#ffffff', padding: '10px', borderRadius: '12px', display: 'flex' }}>
                <Pill color="#047857" size={32} />
              </div>
              <h2 style={{ fontSize: '28px', fontWeight: '800', margin: 0, color: '#ffffff', lineHeight: '1.2' }}>
                Smart Medicine <br />
                <span style={{ color: '#86efac' }}>Forecasting</span>
              </h2>
            </div>
            <p style={{ fontSize: '15px', color: '#d1fae5', marginTop: '10px', maxWidth: '340px' }}>
              Une meilleure gestion pour une pharmacie plus forte.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', margin: 'auto 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.18)', padding: '12px', borderRadius: '50%', display: 'flex' }}>
                <BarChart2 color="#ffffff" size={22} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>Suivi des stocks</h4>
                <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#a7f3d0' }}>Évitez les ruptures de stock</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.18)', padding: '12px', borderRadius: '50%', display: 'flex' }}>
                <Calendar color="#ffffff" size={22} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>Prévisions intelligentes</h4>
                <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#a7f3d0' }}>Commandez au bon moment</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.18)', padding: '12px', borderRadius: '50%', display: 'flex' }}>
                <ShieldCheck color="#ffffff" size={22} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>Gestion simplifiée</h4>
                <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#a7f3d0' }}>Pour une pharmacie plus efficace</p>
              </div>
            </div>
          </div>

          <p style={{ fontStyle: 'italic', fontSize: '15px', color: '#a7f3d0', margin: 0 }}>
            Votre partenaire pour une santé accessible à tous
          </p>
        </div>

        {/* CÔTÉ DROIT */}
        <div style={{
          flex: '1',
          padding: '40px 60px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#ffffff',
          boxSizing: 'border-box'
        }}>
          <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: '13px', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Globe size={16} /> Français
            </span>
          </div>

          <div style={{ width: '100%', maxWidth: '380px', margin: 'auto 0' }}>
            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
              <div style={{ backgroundColor: '#d1fae5', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px auto' }}>
                <Pill color="#047857" size={32} />
              </div>
              <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#064e3b', margin: 0 }}>Smart Medicine</h2>
              <p style={{ fontSize: '16px', fontWeight: '700', color: '#059669', margin: '2px 0 10px 0' }}>Forecasting</p>
              <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a', margin: '15px 0 0 0' }}>Bon retour !</h3>
              <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Connectez-vous pour accéder à votre espace.</p>
            </div>

            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#0f172a', marginBottom: '6px' }}>
                  Adresse e-mail ou nom d’utilisateur
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={18} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '13px' }} />
                  <input 
                    type="text" 
                    required 
                    value={usernameInput} 
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder="exemple@pharmacie.mg ou pharmacie"
                    style={{ width: '100%', padding: '11px 14px 11px 42px', borderRadius: '10px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#0f172a', marginBottom: '6px' }}>
                  Mot de passe
                </label>
                <div style={{ position: 'relative' }}>
                  <ShieldCheck size={18} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '13px' }} />
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    required 
                    value={passwordInput} 
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Votre mot de passe"
                    style={{ width: '100%', padding: '11px 42px 11px 42px', borderRadius: '10px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '12px', top: '12px', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', fontSize: '13px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', cursor: 'pointer' }}>
                  <input type="checkbox" defaultChecked style={{ accentColor: '#047857' }} /> Se souvenir de moi
                </label>
                <a href="#forgot" onClick={(e) => { e.preventDefault(); toast("Contactez le superadmin pour réinitialiser le mot de passe."); }} style={{ color: '#047857', textDecoration: 'none', fontWeight: '600' }}>
                  Mot de passe oublié ?
                </a>
              </div>

              <button 
                type="submit" 
                disabled={loadingLogin}
                style={{ width: '100%', backgroundColor: '#047857', color: '#ffffff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <LogIn size={18} /> {loadingLogin ? 'Connexion...' : 'Se connecter'}
              </button>
            </form>
          </div>

          <div style={{ width: '100%', maxWidth: '380px', display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#f0fdf4', padding: '12px', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
            <ShieldCheck color="#047857" size={24} />
            <p style={{ margin: 0, fontSize: '11px', color: '#065f46', lineHeight: '1.3' }}>
              <strong>Vos données sont sécurisées</strong><br />
              Smart Medicine Forecasting respecte la confidentialité de vos informations.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // DASHBOARD PRINCIPAL
  return (
    <div style={{ padding: '30px', fontFamily: "'Segoe UI', Roboto, sans-serif", backgroundColor: '#f0fdf4', minHeight: '100vh' }}>
      <Toaster position="top-right" />
      
      {/* HEADER */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: '#ffffff', padding: '16px 24px', borderRadius: '12px',
        boxShadow: '0 2px 10px rgba(5, 150, 105, 0.08)', marginBottom: '25px', borderLeft: '6px solid #059669'
      }}>
        <h1 style={{ color: '#065f46', display: 'flex', alignItems: 'center', gap: '12px', margin: 0, fontSize: '22px' }}>
          <Pill color="#059669" size={32} /> Smart Medicine Forecasting
        </h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ textAlign: 'right' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', color: '#064e3b' }}>
              <User size={16} /> {currentUser.username}
            </span>
            <span style={{ fontSize: '12px', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
              <ShieldCheck size={12} /> {currentUser.role === 'superadmin' ? 'SuperAdmin' : 'Admin Pharmacie'}
            </span>
          </div>

          <button
            onClick={handleLogout}
            style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', fontSize: '13px' }}
          >
            <LogOut size={16} /> Déconnexion
          </button>
        </div>
      </div>

      {/* SECTION EXCLUSIVE SUPERADMIN : GESTION DES UTILISATEURS */}
      {currentUser.role === 'superadmin' && (
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '25px', border: '1px solid #a7f3d0', borderTop: '5px solid #047857' }}>
          <h2 style={{ fontSize: '18px', color: '#065f46', margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={22} color="#047857" /> Administration : Gestion des Comptes Utilisateurs
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '20px' }}>
            {/* Formulaire création */}
            <form onSubmit={handleCreateUser} style={{ background: '#f0fdf4', padding: '15px', borderRadius
