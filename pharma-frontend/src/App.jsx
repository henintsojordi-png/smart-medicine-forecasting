import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import { 
  Pill, Calendar, AlertTriangle, CheckCircle, 
  PlusCircle, MinusCircle, RefreshCw, BarChart2, History, 
  ArrowUpRight, ArrowDownRight, Trash2, Download, LogIn, LogOut, User, ShieldCheck,
  Eye, EyeOff, Globe, UserPlus, Users, Edit3
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const styles = {
  container: { padding: '30px', fontFamily: 'sans-serif', backgroundColor: '#f0fdf4', minHeight: '100vh' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: '16px 24px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(5, 150, 105, 0.08)', marginBottom: '25px', borderLeft: '6px solid #059669' },
  card: { background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '25px', border: '1px solid #a7f3d0' },
  cardHeader: { fontSize: '18px', color: '#065f46', margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '8px' },
  input: { width: '100%', padding: '9px', marginTop: '4px', borderRadius: '6px', border: '1px solid #6ee7b7', boxSizing: 'border-box' },
  btnPrimary: { background: '#059669', color: '#fff', border: 'none', padding: '10px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' },
  btnDanger: { background: '#fee2e2', color: '#dc2626', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' },
  th: { padding: '10px', borderBottom: '2px solid #a7f3d0', color: '#065f46' },
  td: { padding: '10px', borderBottom: '1px solid #ecfdf5' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }
};

function App() {
  const API_URL = process.env.REACT_APP_API_URL || 'https://smart-medicine-forecasting.onrender.com';

  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('pharma_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loadingLogin, setLoadingLogin] = useState(false);

  const [medicaments, setMedicaments] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [mouvements, setMouvements] = useState([]);

  const [newMedNom, setNewMedNom] = useState('');
  const [newMedQte, setNewMedQte] = useState(10);
  const [newMedSeuil, setNewMedSeuil] = useState(15);
  const [loadingCreateMed, setLoadingCreateMed] = useState(false);

  const [usersList, setUsersList] = useState([]);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('admin_pharmacie');
  const [loadingCreateUser, setLoadingCreateUser] = useState(false);

  const [selectedMed, setSelectedMed] = useState('');
  const [mois, setMois] = useState(1);
  const [prediction, setPrediction] = useState(null);
  const [loadingPredict, setLoadingPredict] = useState(false);

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
      console.error(err);
      toast.error('Erreur lors de la recuperation des donnees');
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API_URL}/utilisateurs`);
      setUsersList(res.data || []);
    } catch (err) {
      console.error(err);
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

      const userData = { username: res.data.username, role: res.data.role };
      setCurrentUser(userData);
      localStorage.setItem('pharma_user', JSON.stringify(userData));
      toast.success(`Bienvenue, ${res.data.username} !`);
    } catch (err) {
      toast.error('Identifiants incorrects');
    } finally {
      setLoadingLogin(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('pharma_user');
    setPrediction(null);
    toast.success('Deconnexion reussie');
  };

  const handleCreateMedicament = async (e) => {
    e.preventDefault();
    setLoadingCreateMed(true);
    try {
      await axios.post(`${API_URL}/medicaments`, {
        nom: newMedNom,
        quantite_initiale: Number(newMedQte),
        seuil_alerte: Number(newMedSeuil)
      });
      toast.success('Medicament ajoute au catalogue !');
      setNewMedNom('');
      setNewMedQte(10);
      setNewMedSeuil(15);
      await fetchInitialData();
    } catch (err) {
      toast.error('Erreur lors de l ajout');
    } finally {
      setLoadingCreateMed(false);
    }
  };

  const handleDeleteMedicament = async (medId, nom) => {
    if (window.confirm(`Supprimer "${nom}" du catalogue ?`)) {
      try {
        await axios.delete(`${API_URL}/medicaments/${medId}`);
        toast.success('Medicament supprime !');
        await fetchInitialData();
      } catch (err) {
        toast.error('Erreur lors de la suppression');
      }
    }
  };

  const handleUpdateSeuil = async (medId, currentSeuil) => {
    const newSeuil = window.prompt('Entrez le nouveau seuil d alerte :', currentSeuil);
    if (newSeuil && !isNaN(newSeuil)) {
      try {
        await axios.put(`${API_URL}/stocks/seuil`, {
          medicament_id: Number(medId),
          seuil_alerte: Number(newSeuil)
        });
        toast.success('Seuil mis a jour !');
        await fetchInitialData();
      } catch (err) {
        toast.error('Echec de la mise a jour');
      }
    }
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
      toast.success('Nouvel utilisateur cree !');
      setNewUsername('');
      setNewPassword('');
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors de la creation');
    } finally {
      setLoadingCreateUser(false);
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (window.confirm(`Supprimer le compte "${username}" ?`)) {
      try {
        await axios.delete(`${API_URL}/utilisateurs/${userId}`);
        toast.success('Utilisateur supprime !');
        fetchUsers();
      } catch (err) {
        toast.error('Erreur lors de la suppression');
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
      toast.success('Donnees actualisees !');
    } catch (err) {
      toast.error('Echec de l actualisation');
    }
  };

  const exportToCSV = () => {
    if (mouvements.length === 0) return toast.error('Aucun mouvement a exporter');

    const headers = ['ID', 'Date', 'Type', 'Medicament', 'Quantite'];
    const rows = mouvements.map(m => [
      m.id,
      `"${new Date(m.date_mouvement).toLocaleString('fr-FR')}"`,
      m.type_mouvement,
      `"${m.medicament}"`,
      m.type_mouvement === 'ENTREE' ? `+${m.quantite}` : `-${m.quantite}`
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `historique_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Export CSV telecharge !');
  };

  const handleClearHistory = async () => {
    if (window.confirm('Supprimer tout l historique ?')) {
      try {
        await axios.delete(`${API_URL}/mouvements`);
        setMouvements([]);
        toast.success('Historique efface !');
      } catch (err) {
        toast.error('Erreur lors de la suppression');
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
      toast.success('Prevision calculee !');
    } catch (err) {
      toast.error('Erreur de calcul');
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
      toast.success('Stock ajoute !');
    } catch (err) {
      toast.error('Erreur lors de l ajout');
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
      toast.success('Stock retire !');
    } catch (err) {
      toast.error('Erreur lors du retrait');
    } finally {
      setLoadingSortie(false);
    }
  };

  const chartData = (stocks || []).map(item => ({
    nom: item.medicament,
    'Stock Reel': item.quantite_disponible,
    'Seuil Alerte': item.seuil_alerte
  }));

  if (!currentUser) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'sans-serif', backgroundColor: '#ffffff' }}>
        <Toaster position="top-right" />
        <div style={{ flex: '1.1', background: '#047857', padding: '50px', color: '#ffffff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <Pill size={32} />
              <h2 style={{ fontSize: '28px', margin: 0 }}>Smart Medicine Forecasting</h2>
            </div>
            <p style={{ marginTop: '10px', color: '#d1fae5' }}>Une meilleure gestion pour une pharmacie plus forte.</p>
          </div>
        </div>

        <div style={{ flex: '1', padding: '40px 60px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          <form onSubmit={handleLogin} style={{ width: '100%', maxWidth: '360px' }}>
            <h3 style={{ fontSize: '20px', color: '#0f172a', marginBottom: '20px' }}>Connexion</h3>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ fontSize: '13px', fontWeight: '600' }}>Nom utilisateur</label>
              <input 
                type="text" required value={usernameInput} onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="ex: superadmin ou pharmacie" style={styles.input}
              />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '13px', fontWeight: '600' }}>Mot de passe</label>
              <input 
                type={showPassword ? 'text' : 'password'} required value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Votre mot de passe" style={styles.input}
              />
            </div>
            <button type="submit" disabled={loadingLogin} style={{ ...styles.btnPrimary, width: '100%' }}>
              {loadingLogin ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <Toaster position="top-right" />
      
      <div style={styles.header}>
        <h1 style={{ color: '#065f46', display: 'flex', alignItems: 'center', gap: '12px', margin: 0, fontSize: '22px' }}>
          <Pill color="#059669" size={32} /> Smart Medicine Forecasting
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span style={{ fontWeight: 'bold', color: '#064e3b' }}>{currentUser.username} ({currentUser.role})</span>
          <button onClick={handleLogout} style={styles.btnDanger}><LogOut size={14} /> Déconnexion</button>
        </div>
      </div>

      {currentUser.role === 'superadmin' && (
        <div style={{ ...styles.card, borderTop: '5px solid #047857' }}>
          <h2 style={styles.cardHeader}><Users size={22} /> Administration : Gestion des Comptes Utilisateurs</h2>
          <div style={styles.grid2}>
            <form onSubmit={handleCreateUser} style={{ background: '#f0fdf4', padding: '15px', borderRadius: '8px' }}>
              <h3 style={{ fontSize: '14px', color: '#064e3b', margin: '0 0 10px 0' }}>Créer un utilisateur</h3>
              <input type="text" required placeholder="Nom utilisateur" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} style={styles.input} />
              <input type="password" required placeholder="Mot de passe" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={{ ...styles.input, marginTop: '10px' }} />
              <select value={newRole} onChange={(e) => setNewRole(e.target.value)} style={{ ...styles.input, marginTop: '10px' }}>
                <option value="admin_pharmacie">Admin Pharmacie</option>
                <option value="superadmin">SuperAdmin</option>
              </select>
              <button type="submit" disabled={loadingCreateUser} style={{ ...styles.btnPrimary, width: '100%', marginTop: '15px' }}>
                {loadingCreateUser ? 'Création...' : 'Ajouter utilisateur'}
              </button>
            </form>

            <table style={styles.table}>
              <thead>
                <tr><th style={styles.th}>Nom</th><th style={styles.th}>Rôle</th><th style={{ ...styles.th, textAlign: 'right' }}>Action</th></tr>
              </thead>
              <tbody>
                {usersList.map(u => (
                  <tr key={u.id}>
                    <td style={styles.td}>{u.username}</td>
                    <td style={styles.td}>{u.role}</td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      {u.username !== 'superadmin' && (
                        <button onClick={() => handleDeleteUser(u.id, u.username)} style={styles.btnDanger}>Supprimer</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ ...styles.card, borderTop: '5px solid #059669' }}>
        <h2 style={styles.cardHeader}><Pill size={22} /> Catalogue : Ajouter un Nouveau Médicament</h2>
        <form onSubmit={handleCreateMedicament} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '15px', alignItems: 'end' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: '600' }}>Nom du médicament</label>
            <input type="text" required value={newMedNom} onChange={(e) => setNewMedNom(e.target.value)} placeholder="ex: Spasfon 80mg" style={styles.input} />
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: '600' }}>Stock Initial</label>
            <input type="number" min="0" value={newMedQte} onChange={(e) => setNewMedQte(e.target.value)} style={styles.input} />
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: '600' }}>Seuil Alerte</label>
            <input type="number" min="1" value={newMedSeuil} onChange={(e) => setNewMedSeuil(e.target.value)} style={styles.input} />
          </div>
          <button type="submit" disabled={loadingCreateMed} style={styles.btnPrimary}>
            {loadingCreateMed ? 'Ajout...' : '+ Ajouter au Catalogue'}
          </button>
        </form>
      </div>

      <div style={styles.grid2}>
        <div style={styles.card}>
          <h2 style={styles.cardHeader}>Formulaire de Prévision (IA)</h2>
          <form onSubmit={handlePredict}>
            <div style={{ marginBottom: '15px' }}>
              <label>Médicament :</label>
              <select value={selectedMed} onChange={(e) => setSelectedMed(e.target.value)} style={styles.input}>
                {medicaments.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label>Mois cible :</label>
              <input type="number" min="1" max="12" value={mois} onChange={(e) => setMois(e.target.value)} style={styles.input} />
            </div>
            <button type="submit" disabled={loadingPredict} style={{ ...styles.btnPrimary, width: '100%' }}>
              {loadingPredict ? 'Calcul...' : 'Lancer la prévision'}
            </button>
          </form>
          {prediction !== null && (
            <div style={{ marginTop: '15px', padding: '12px', background: '#d1fae5', borderRadius: '6px' }}>
              <strong>Quantité préconisée : {prediction} unités</strong>
            </div>
          )}
        </div>

        <div style={styles.card}>
          <div style={{ display: 'flex', justifyContent
