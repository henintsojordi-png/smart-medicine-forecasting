import pandas as pd
import psycopg2
from sklearn.ensemble import RandomForestRegressor

# 1. Connexion TCP/IP avec mot de passe
try:
    conn = psycopg2.connect(
        dbname="pharma_predict",
        user="postgres",
        password="postgres",
        host="127.0.0.1",
        port="5432"
    )
    print(" Connexion à la base de données réussie !")
except Exception as e:
    print(f" Erreur de connexion : {e}")
    exit()

# 2. Extraction des données
query = """
SELECT 
    m.id AS medicament_id,
    m.nom_commercial,
    ms.etablissement_id,
    EXTRACT(MONTH FROM ms.date_mouvement) AS mois,
    EXTRACT(YEAR FROM ms.date_mouvement) AS annee,
    SUM(ms.quantite) AS total_consomme
FROM mouvement_stock ms
JOIN lot l ON ms.lot_id = l.id
JOIN medicament m ON l.medicament_id = m.id
WHERE ms.type_mouvement = 'SORTIE'
GROUP BY m.id, m.nom_commercial, ms.etablissement_id, annee, mois;
"""

df = pd.read_sql_query(query, conn)
conn.close()

print("\n--- Données d'historique récupérées ---")
print(df)

# 3. Prédiction ML
if not df.empty:
    X = df[['medicament_id', 'etablissement_id', 'mois']]
    y = df['total_consomme']

    model = RandomForestRegressor(n_estimators=100, random_state=42)
    model.fit(X, y)

    sample_input = [[1, 1, 10]] 
    prediction = model.predict(sample_input)

    print("\n--- Résultat de la prévision Machine Learning ---")
    print(f"Prévision de besoin pour Amoxicilline (Mois 10) : {int(prediction[0])} unités")
else:
    print("\n Aucune donnée de consommation trouvée.")
