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
