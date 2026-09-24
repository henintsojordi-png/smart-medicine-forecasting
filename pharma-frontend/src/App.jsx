import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import { 
  Pill, Building2, Calendar, AlertTriangle, CheckCircle, 
  PlusCircle, MinusCircle, RefreshCw, BarChart2, History, 
  ArrowUpRight, ArrowDownRight, Trash2, Download 
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function App() {
  // Définition dynamique de l'adresse du backend (Vercel Production ou Local)
  const API_URL = process.env.REACT_APP_API_URL || 'https://smart-medicine-forecasting.onrender.com';

  const [medicaments, setMedicaments] = useState([]);
  const [etablissements, setEtablissements] = useState([]);
  const [stocks, setStocks] = useState(null);
  const [mouvements, setMouvements] = useState([]);
  
  // États Prévision IA
  const [selectedMed, setSelectedMed] = useState(1);
  const [selectedEtab, setSelectedEtab] = useState(1);
  const [mois, setMois] = useState(1);
  const [prediction, setPrediction] = useState(null);
  const [loadingPredict, setLoadingPredict] = useState(false);

  // États ENTRÉE de stock
  const [entreeEtab, setEntreeEtab] = useState(1);
  const [entreeMed, setEntreeMed] = useState(1);
  const [quantiteEntree, setQuantiteEntree] = useState(10);
  const [loadingEntree, setLoadingEntree] = useState(false);

  // États SORTIE de stock
  const [sortieEtab, setSortieEtab] = useState(1);
  const [sortieMed, setSortieMed] = useState(1);
  const [quantiteSortie, setQuantiteSortie] = useState(5);
  const [loadingSortie, setLoadingSortie] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [resMeds, resEtabs, resMouvements] = await Promise.all([
        axios.get(`${API_URL}/medicaments`),
        axios.get(`${API_URL}/etablissements`),
        axios.get(`${API_URL}/mouvements`)
      ]);
      
      setMedicaments(resMeds.data || []);
      setEtablissements(resEtabs.data || []);
      setMouvements(resMouvements.data || []);
      
      if (resMeds.data && resMeds.data.length > 0) {
        const firstMedId = resMeds.data[0].id;
        setSelectedMed(firstMedId);
        setEntreeMed(firstMedId);
        setSortieMed(firstMedId);
      }
      if (resEtabs.data && resEtabs.data.length > 0) {
        const firstEtabId = resEtabs.data[0].id;
        setSelectedEtab(firstEtabId);
        setEntreeEtab(firstEtabId);
        setSortieEtab(firstEtabId);
      }
    } catch (err) {
      console.error("Erreur de chargement des données:", err);
      toast.error("Erreur de connexion au serveur backend");
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
      console.error("Erreur lors du rafraîchissement :", err);
      toast.error("Échec de l'actualisation");
    }
  };

  // Exportation CSV
  const exportToCSV = () => {
    if (mouvements.length === 0) {
      toast.error("Aucun mouvement à exporter");
      return;
    }

    const headers = ["ID", "Date et Heure", "Type", "Medicament", "Etablissement", "Quantite"];
    
    const rows = mouvements.map(m => [
      m.id,
      `"${new Date(m.date_mouvement).toLocaleString('fr-FR')}"`,
      m.type_mouvement,
      `"${m.medicament}"`,
      `"${m.etablissement}"`,
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

  // Vider l'historique
  const handleClearHistory = async () => {
    if (window.confirm("Voulez-vous vraiment supprimer tout l'historique des mouvements ?")) {
      try {
        await axios.delete(`${API_URL}/mouvements`);
        setMouvements([]);
        toast.success("Historique effacé avec succès");
      } catch (err) {
        console.error("Erreur lors de la suppression de l'historique:", err);
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
        etablissement_id: Number(selectedEtab),
        mois: Number(mois)
      });
      setPrediction(resPredict.data.quantite_prevue);

      const resStocks = await axios.get(`${API_URL}/stocks`);
      setStocks(resStocks.data || []);
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
        etablissement_id: Number(entreeEtab),
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
        etablissement_id: Number(sortieEtab),
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
    nom: `${item.medicament} (${item.etablissement})`,
    "Stock Réel": item.quantite_disponible,
    "Seuil Alerte": item.seuil_alerte
  }));

  return (
    <div style={{ padding: '30px', fontFamily: 'Arial, sans-serif', backgroundColor: '#f4f6f9', minHeight: '100vh' }}>
      <Toaster position="top-right" />
      
      <h1 style={{ color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Pill color="#2563eb" size={36} /> Smart Medicine Forecasting
      </h1>

      {/* PRÉVISION & STOCKS */}
      <div style={{ display: 'grid', gridTemplateColumns: stocks ? '1fr 1fr' : '1fr', gap: '20px', marginTop: '20px' }}>
        
        {/* Formulaire de Prévision IA */}
        <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
          <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>Formulaire de Prévision (IA)</h2>
          <form onSubmit={handlePredict}>
            <div style={{ marginBottom: '15px' }}>
              <label><Building2 size={16} /> Établissement :</label>
              <select value={selectedEtab} onChange={(e) => setSelectedEtab(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: '5px' }}>
                {etablissements.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label><Pill size={16} /> Médicament :</label>
              <select value={selectedMed} onChange={(e) => setSelectedMed(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: '5px' }}>
                {medicaments.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label><Calendar size={16} /> Mois cible :</label>
              <input type="number" min="1" max="12" value={mois} onChange={(e) => setMois(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: '5px' }} />
            </div>

            <button type="submit" disabled={loadingPredict} style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '5px', cursor: 'pointer', width: '100%', fontWeight: 'bold' }}>
              {loadingPredict ? 'Calcul & Chargement...' : 'Lancer la prévision'}
            </button>
          </form>

          {prediction !== null && (
            <div style={{ marginTop: '20px', padding: '15px', background: '#e0f2fe', borderRadius: '5px', color: '#0369a1' }}>
              <h3>Quantité préconisée : <strong>{prediction} unités</strong></h3>
            </div>
          )}
        </div>

        {/* Tableau des stocks */}
        {stocks && (
          <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h2 style={{ fontSize: '18px', margin: 0 }}>État des Stocks & Alertes</h2>
              <button 
                type="button"
                onClick={refreshStocksAndHistory} 
                style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 'bold', color: '#334155' }}
              >
                <RefreshCw size={14} /> Actualiser
              </button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #ddd' }}>
                  <th style={{ padding: '8px' }}>Médicament</th>
                  <th style={{ padding: '8px' }}>Établissement</th>
                  <th style={{ padding: '8px' }}>Stock</th>
                  <th style={{ padding: '8px' }}>Statut</th>
                </tr>
              </thead>
              <tbody>
                {stocks.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '8px' }}>{s.medicament}</td>
                    <td style={{ padding: '8px' }}>{s.etablissement}</td>
                    <td style={{ padding: '8px' }}><strong>{s.quantite_disponible}</strong></td>
                    <td style={{ padding: '8px' }}>
                      {s.alerte_rupture ? (
                        <span style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}>
                          <AlertTriangle size={16} /> Rupture proche
                        </span>
                      ) : (
                        <span style={{ color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle size={16} /> Ok
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* GRAPHIQUE RECHARTS */}
      {stocks && (
        <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', marginTop: '20px' }}>
          <h2 style={{ fontSize: '18px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b' }}>
            <BarChart2 size={22} color="#2563eb" /> Comparatif Visuel des Stocks
          </h2>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="nom" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Stock Réel" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Seuil Alerte" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ENTRÉE ET SORTIE DE STOCK */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
        {/* ENTRÉE */}
        <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', borderTop: '4px solid #16a34a' }}>
          <h2 style={{ fontSize: '18px', marginBottom: '15px', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PlusCircle size={20} /> Entrée de Stock
          </h2>
          <form onSubmit={handleEntreeSubmit}>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '14px' }}>Établissement :</label>
              <select value={entreeEtab} onChange={(e) => setEntreeEtab(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: '4px' }}>
                {etablissements.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '14px' }}>Médicament :</label>
              <select value={entreeMed} onChange={(e) => setEntreeMed(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: '4px' }}>
                {medicaments.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ fontSize: '14px' }}>Quantité à ajouter :</label>
              <input type="number" min="1" value={quantiteEntree} onChange={(e) => setQuantiteEntree(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: '4px' }} />
            </div>
            <button type="submit" disabled={loadingEntree} style={{ width: '100%', background: '#16a34a', color: '#fff', border: 'none', padding: '10px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
              {loadingEntree ? 'Mise à jour...' : 'Ajouter au Stock (+)'}
            </button>
          </form>
        </div>

        {/* SORTIE */}
        <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', borderTop: '4px solid #dc2626' }}>
          <h2 style={{ fontSize: '18px', marginBottom: '15px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MinusCircle size={20} /> Sortie de Stock
          </h2>
          <form onSubmit={handleSortieSubmit}>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '14px' }}>Établissement :</label>
              <select value={sortieEtab} onChange={(e) => setSortieEtab(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: '4px' }}>
                {etablissements.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '14px' }}>Médicament :</label>
              <select value={sortieMed} onChange={(e) => setSortieMed(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: '4px' }}>
                {medicaments.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ fontSize: '14px' }}>Quantité à retirer :</label>
              <input type="number" min="1" value={quantiteSortie} onChange={(e) => setQuantiteSortie(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: '4px' }} />
            </div>
            <button type="submit" disabled={loadingSortie} style={{ width: '100%', background: '#dc2626', color: '#fff', border: 'none', padding: '10px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
              {loadingSortie ? 'Mise à jour...' : 'Retirer du Stock (-)'}
            </button>
          </form>
        </div>
      </div>

      {/* HISTORIQUE DES MOUVEMENTS */}
      <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', marginTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2 style={{ fontSize: '18px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b' }}>
            <History size={22} color="#2563eb" /> Historique Récent des Mouvements de Stock
          </h2>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              type="button" 
              onClick={exportToCSV}
              disabled={mouvements.length === 0}
              title="Télécharger l'historique en CSV"
              style={{ 
                background: mouvements.length === 0 ? '#f1f5f9' : '#e0f2fe', 
                border: '1px solid #7dd3fc', 
                padding: '6px 12px', 
                borderRadius: '5px', 
                cursor: mouvements.length === 0 ? 'not-allowed' : 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                color: mouvements.length === 0 ? '#94a3b8' : '#0369a1', 
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
                style={{ background: '#fee2e2', border: '1px solid #fca5a5', padding: '6px 10px', borderRadius: '5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: '#dc2626', fontSize: '13px', fontWeight: 'bold' }}
              >
                <Trash2 size={16} /> Vider
              </button>
            )}
          </div>
        </div>

        {mouvements.length === 0 ? (
          <p style={{ color: '#64748b', fontStyle: 'italic' }}>Aucun mouvement enregistré pour le moment.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ddd', color: '#475569' }}>
                <th style={{ padding: '8px' }}>Date & Heure</th>
                <th style={{ padding: '8px' }}>Type</th>
                <th style={{ padding: '8px' }}>Médicament</th>
                <th style={{ padding: '8px' }}>Établissement</th>
                <th style={{ padding: '8px' }}>Quantité</th>
              </tr>
            </thead>
            <tbody>
              {mouvements.map(m => (
                <tr key={m.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '8px', color: '#64748b', fontSize: '13px' }}>
                    {new Date(m.date_mouvement).toLocaleString('fr-FR')}
                  </td>
                  <td style={{ padding: '8px' }}>
                    {m.type_mouvement === 'ENTREE' ? (
                      <span style={{ color: '#16a34a', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <ArrowUpRight size={16} /> Entrée
                      </span>
                    ) : (
                      <span style={{ color: '#dc2626', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <ArrowDownRight size={16} /> Sortie
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '8px' }}>{m.medicament}</td>
                  <td style={{ padding: '8px' }}>{m.etablissement}</td>
                  <td style={{ padding: '8px' }}>
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
