import psycopg2
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
import joblib

DB_PARAMS = {
    "dbname": "pharma_predict",
    "user": "postgres",
    "password": "YOUR_PASSWORD",  # Modifie selon ta config PostgreSQL
    "host": "localhost",
    "port": "5432"
}

def train_and_save():
    print("Connexion à la base de données PostgreSQL...")
    try:
        conn = psycopg2.connect(**DB_PARAMS)
        query = "SELECT medicament_id, etablissement_id, mois, quantite FROM historique_consommation;"
        df = pd.read_sql(query, conn)
        conn.close()
        print("Données chargées depuis PostgreSQL.")
    except Exception as e:
        print(f"Impossible de charger depuis PostgreSQL ({e}). Génération de données de démonstration...")
        df = pd.DataFrame({
            'medicament_id': [1, 1, 2, 2, 3, 3, 1, 2, 4, 4] * 10,
            'etablissement_id': [1, 2, 1, 2, 1, 2, 1, 2, 1, 2] * 10,
            'mois': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] * 10,
            'quantite': [120, 150, 80, 90, 200, 210, 130, 95, 60, 65] * 10
        })

    X = df[['medicament_id', 'etablissement_id', 'mois']]
    y = df['quantite']

    print("Entraînement du modèle RandomForestRegressor...")
    model = RandomForestRegressor(n_estimators=100, random_state=42)
    model.fit(X, y)

    joblib.dump(model, 'modele_pharma.joblib')
    print("Modèle sauvegardé avec succès dans 'modele_pharma.joblib' !")

if __name__ == "__main__":
    train_and_save()
