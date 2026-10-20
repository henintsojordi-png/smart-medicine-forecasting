import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import { 
  Pill, Calendar, AlertTriangle, CheckCircle, 
  PlusCircle, MinusCircle, RefreshCw, BarChart2, History, 
  ArrowUpRight, ArrowDownRight, Trash2, Download, LogIn, LogOut, User, ShieldCheck,
  Eye, EyeOff, Globe
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function App() {
  const API_URL = process.env.REACT_APP_API_URL || 'https://smart-medicine-forecasting.onrender.com';

  // État Authentification
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('pharma_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Formulaire de Login
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loadingLogin, setLoadingLogin] = useState(false);

  // Données métiers
  const [medicaments, setMedicaments] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [mouvements, setMouvements] = useState([]);

  // États Prévision IA
  const [selectedMed, setSelectedMed] = useState('');
  const [mois, setMois] = useState(1);
  const [prediction, setPrediction] = useState(null);
  const [loadingPredict, setLoadingPredict] = useState(false);

  // États ENTRÉE de stock
  const [entreeMed, setEntreeMed] = useState('');
  const [quantiteEntree, setQuantiteEntree] = useState(10);
  const [loadingEntree, setLoadingEntree] = useState(false);

  // États SORTIE de stock
  const [sortieMed, setSortieMed] = useState('');
  const [quantiteSortie, setQuantiteSortie] = useState(5);
  const [loadingSortie, setLoadingSortie] = useState(false);

  useEffect(() => {
    if (currentUser) {
      fetchInitialData();
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

  // PAGE LOGIN (SPLIT SCREEN VERT PHARMACIE)
  if (!currentUser) {
    return (
      <div style={{
        display: 'flex',
        minHeight: '100vh',
        fontFamily: "'Segoe UI', Roboto, sans-serif",
        backgroundColor: '#ffffff'
      }}>
        <Toaster position="top-right" />

        {/* CÔTÉ GAUCHE : BANNIÈRE VISUELLE PHARMACIE */}
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
          {/* Logo & Accroche */}
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

          {/* Points clés */}
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

          {/* Slogan */}
          <p style={{ fontStyle: 'italic', fontSize: '15px', color: '#a7f3d0', margin: 0 }}>
            Votre partenaire pour une santé accessible à tous
          </p>
        </div>

        {/* CÔTÉ DROIT : FORMULAIRE DE CONNEXION */}
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
          {/* Sélecteur de langue */}
          <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: '13px', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <Globe size={16} /> Français
            </span>
          </div>

          {/* Formulaire central */}
          <div style={{ width: '100%', maxWidth: '380px', margin: 'auto 0' }}>
            
            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
              <div style={{
                backgroundColor: '#d1fae5',
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 15px auto'
              }}>
                <Pill color="#047857" size={32} />
              </div>
              <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#064e3b', margin: 0 }}>
                Smart Medicine
              </h2>
              <p style={{ fontSize: '16px', fontWeight: '700', color: '#059669', margin: '2px 0 10px 0' }}>
                Forecasting
              </p>
              <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a', margin: '15px 0 0 0' }}>
                Bon retour !
              </h3>
              <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                Connect
                Connectez-vous pour accéder à votre espace.
              </p>
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
                    style={{
                      width: '100%',
                      padding: '11px 14px 11px 42px',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      outline: 'none',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
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
                    style={{
                      width: '100%',
                      padding: '11px 42px 11px 42px',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      outline: 'none',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '12px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#94a3b8'
                    }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', fontSize: '13px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', cursor: 'pointer' }}>
                  <input type="checkbox" defaultChecked style={{ accentColor: '#047857' }} /> Se souvenir de moi
                </label>
                <a href="#forgot" onClick={(e) => { e.preventDefault(); toast("Veuillez contacter le superadmin pour réinitialiser le mot de passe."); }} style={{ color: '#047857', textDecoration: 'none', fontWeight: '600' }}>
                  Mot de passe oublié ?
                </a>
              </div>

              <button 
                type="submit" 
                disabled={loadingLogin}
                style={{
                  width: '100%',
                  backgroundColor: '#047857',
                  color: '#ffffff',
                  border: 'none',
                  padding: '12px',
                  borderRadius: '10px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  fontSize: '15px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <LogIn size={18} /> {loadingLogin ? 'Connexion en cours...' : 'Se connecter'}
              </button>
            </form>
          </div>

          {/* Pied de page Sécurité */}
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
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        padding: '16px 24px',
        borderRadius: '12px',
        boxShadow: '0 2px 10px rgba(5, 150, 105, 0.08)',
        marginBottom: '25px',
        borderLeft: '6px solid #059669'
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
            style={{
              backgroundColor: '#fee2e2',
              color: '#dc2626',
              border: '1px solid #fca5a5',
              padding: '8px 14px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: '600',
              fontSize: '13px'
            }}
          >
            <LogOut size={16} /> Déconnexion
          </button>
        </div>
      </div>

      {/* PRÉVISION & STOCKS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        
        {/* Formulaire de Prévision IA */}
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', border: '1px solid #a7f3d0' }}>
          <h2 style={{ fontSize: '18px', marginBottom: '15px', color: '#065f46' }}>Formulaire de Prévision (IA)</h2>
          <form onSubmit={handlePredict}>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ color: '#064e3b', fontWeight: '500' }}><Pill size={16} /> Médicament :</label>
              <select 
                value={selectedMed} 
                onChange={(e) => setSelectedMed(e.target.value)} 
                style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '6px', border: '1px solid #6ee7b7' }}
              >
                {medicaments.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ color: '#064e3b', fontWeight: '500' }}><Calendar size={16} /> Mois cible :</label>
              <input 
                type="number" 
                min="1" 
                max="12" 
                value={mois} 
                onChange={(e) => setMois(e.target.value)} 
                style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '6px', border: '1px solid #6ee7b7', boxSizing: 'border-box' }} 
              />
            </div>

            <button 
              type="submit" 
              disabled={loadingPredict} 
              style={{ background: '#059669', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', cursor: 'pointer', width: '100%', fontWeight: 'bold' }}
            >
              {loadingPredict ? 'Calcul en cours...' : 'Lancer la prévision'}
            </button>
          </form>

          {prediction !== null && (
            <div style={{ marginTop: '20px', padding: '15px', background: '#d1fae5', borderRadius: '8px', color: '#065f46', border: '1px solid #6ee7b7' }}>
              <h3 style={{ margin: 0 }}>Quantité préconisée : <strong>{prediction} unités</strong></h3>
            </div>
          )}
        </div>

        {/* Tableau des stocks */}
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', border: '1px solid #a7f3d0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h2 style={{ fontSize: '18px', margin: 0, color: '#065f46' }}>État des Stocks & Alertes</h2>
            <button 
              type="button"
              onClick={refreshStocksAndHistory} 
              style={{ background: '#f0fdf4', border: '1px solid #6ee7b7', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 'bold', color: '#047857' }}
            >
              <RefreshCw size={14} /> Actualiser
            </button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #a7f3d0', color: '#065f46' }}>
                <th style={{ padding: '10px' }}>Médicament</th>
                <th style={{ padding: '10px' }}>Stock</th>
                <th style={{ padding: '10px' }}>Statut</th>
              </tr>
            </thead>
            <tbody>
              {stocks.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid #ecfdf5' }}>
                  <td style={{ padding: '10px' }}>{s.medicament}</td>
                  <td style={{ padding: '10px' }}><strong>{s.quantite_disponible}</strong></td>
                  <td style={{ padding: '10px' }}>
                    {s.alerte_rupture ? (
                      <span style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}>
                        <AlertTriangle size={16} /> Rupture proche
                      </span>
                    ) : (
                      <span style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '500' }}>
                        <CheckCircle size={16} /> En Stock
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* GRAPHIQUE RECHARTS */}
      <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginTop: '20px', border: '1px solid #a7f3d0' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: '#065f46' }}>
          <BarChart2 size={22} color="#059669" /> Comparatif Visuel des Stocks
        </h2>
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="nom" tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="Stock Réel" fill="#059669" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Seuil Alerte" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ENTRÉE ET SORTIE DE STOCK */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
        {/* ENTRÉE */}
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', borderTop: '4px solid #059669' }}>
          <h2 style={{ fontSize: '18px', marginBottom: '15px', color: '#059669', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PlusCircle size={20} /> Entrée de Stock
          </h2>
          <form onSubmit={handleEntreeSubmit}>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '14px', color: '#064e3b' }}>Médicament :</label>
              <select 
                value={entreeMed} 
                onChange={(e) => setEntreeMed(e.target.value)} 
                style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '6px', border: '1px solid #6ee7b7' }}
              >
                {medicaments.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ fontSize: '14px', color: '#064e3b' }}>Quantité à ajouter :</label>
              <input 
                type="number" 
                min="1" 
                value={quantiteEntree} 
                onChange={(e) => setQuantiteEntree(e.target.value)} 
                style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '6px', border: '1px solid #6ee7b7', boxSizing: 'border-box' }} 
              />
            </div>
            <button 
              type="submit" 
              disabled={loadingEntree} 
              style={{ width: '100%', background: '#059669', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              {loadingEntree ? 'Mise à jour...' : 'Ajouter au Stock (+)'}
            </button>
          </form>
        </div>

        {/* SORTIE */}
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', borderTop: '4px solid #dc2626' }}>
          <h2 style={{ fontSize: '18px', marginBottom: '15px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MinusCircle size={20} /> Sortie de Stock
          </h2>
          <form onSubmit={handleSortieSubmit}>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '14px', color: '#064e3b' }}>Médicament :</label>
              <select 
                value={sortieMed} 
                onChange={(e) => setSortieMed(e.target.value)} 
                style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '6px', border: '1px solid #fca5a5' }}
              >
                {medicaments.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ fontSize: '14px', color: '#064e3b' }}>Quantité à retirer :</label>
              <input 
                type="number" 
                min="1" 
                value={quantiteSortie} 
                onChange={(e) => setQuantiteSortie(e.target.value)} 
                style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '6px', border: '1px solid #fca5a5', boxSizing: 'border-box' }} 
              />
            </div>
            <button 
              type="submit" 
              disabled={loadingSortie} 
              style={{ width: '100%', background: '#dc2626', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              {loadingSortie ? 'Mise à jour...' : 'Retirer du Stock (-)'}
            </button>
          </form>
        </div>
      </div>

      {/* HISTORIQUE DES MOUVEMENTS */}
      <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginTop: '20px', border: '1px solid #a7f3d0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2 style={{ fontSize: '18px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#065f46' }}>
            <History size={22} color="#059669" /> Historique Récent des Mouvements de Stock
          </h2>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              type="button" 
              onClick={exportToCSV}
              disabled={mouvements.length === 0}
              title="Télécharger l'historique en CSV"
              style={{ 
                background: mouvements.length === 0 ? '#f1f5f9' : '#d1fae5', 
                border: '1px solid #6ee7b7', 
                padding: '6px 12px', 
                borderRadius: '6px', 
                cursor: mouvements.length === 0 ? 'not-allowed' : 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                color: mouvements.length === 0 ? '#94a3b8' : '#065f46', 
                fontSize: '13px', 
                fontWeight: 'bold' 
              }}
            >
              <Download size={16} /> Exporter CSV
            </button>
            {mouvements.length > 0 && (
              <button 
                type="button" 
                onClick={handleClearHistory}
                title="Vider l'historique"
                style={{ background: '#fee2e2', border: '1px solid #fca5a5', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: '#dc2626', fontSize: '13px', fontWeight: 'bold' }}
              >
                <Trash2 size={16} /> Vider
              </button>
            )}
          </div>
        </div>

        {mouvements.length === 0 ? (
          <p style={{ color: '#047857', fontStyle: 'italic' }}>Aucun mouvement enregistré pour le moment.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #a7f3d0', color: '#065f46' }}>
                <th style={{ padding: '10px' }}>Date & Heure</th>
                <th style={{ padding: '10px' }}>Type</th>
                <th style={{ padding: '10px' }}>Médicament</th>
                <th style={{ padding: '10px' }}>Quantité</th>
              </tr>
            </thead>
            <tbody>
              {mouvements.map(m => (
                <tr key={m.id} style={{ borderBottom: '1px solid #ecfdf5' }}>
                  <td style={{ padding: '10px', color: '#047857', fontSize: '13px' }}>
                    {new Date(m.date_mouvement).toLocaleString('fr-FR')}
                  </td>
                  <td style={{ padding: '10px' }}>
                    {m.type_mouvement === 'ENTREE' ? (
                      <span style={{ color: '#059669', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <ArrowUpRight size={16} /> Entrée
                      </span>
                    ) : (
                      <span style={{ color: '#dc2626', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <ArrowDownRight size={16} /> Sortie
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '10px' }}>{m.medicament}</td>
                  <td style={{ padding: '10px' }}>
                    <strong>{m.type_mouvement === 'ENTREE' ? `+${m.quantite}` : `-${m.quantite}`}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}

export default App;
