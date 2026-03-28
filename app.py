import numpy as np
import pickle
import os
import random
import jwt
import datetime
from functools import wraps
from flask import Flask, request, render_template, jsonify, make_response, redirect
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///mindfuel.db'
app.config['SECRET_KEY'] = 'hackfest_2026_secret_key'
db = SQLAlchemy(app)
bcrypt = Bcrypt(app)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password = db.Column(db.String(100), nullable=False)

os.environ["CUDA_VISIBLE_DEVICES"] = "-1"

try:
    from tensorflow.keras.models import load_model
    from tensorflow.keras.preprocessing.sequence import pad_sequences
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False

model, tokenizer, scaler, label_encoder = None, None, None, None

if TF_AVAILABLE:
    try:
        model = load_model('stress_hybrid_model.h5')
        with open('tokenizer.pickle', 'rb') as h: tokenizer = pickle.load(h)
        with open('scaler.pickle', 'rb') as h: scaler = pickle.load(h)
        with open('label_encoder.pickle', 'rb') as h: label_encoder = pickle.load(h)
    except Exception:
        pass

MAX_LEN = 100

def get_prediction(text, sleep, work, screen, activity):
    def fallback(t):
        t_low = t.lower()
        if any(w in t_low for w in ['depress', 'stress', 'bad', 'overwhelm', 'panic', 'anxi']):
            return "High"
        return "Medium"

    if not model:
        return fallback(text)
    
    try:
        seq = tokenizer.texts_to_sequences([text])
        padded = pad_sequences(seq, maxlen=MAX_LEN, padding='post', truncating='post')
        features = np.array([[sleep, work, screen, activity]])
        scaled_features = scaler.transform(features)
        prediction = model.predict([padded, scaled_features])
        class_idx = np.argmax(prediction)
        return label_encoder.inverse_transform([class_idx])[0]
    except Exception:
        return fallback(text)

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.cookies.get('token')
        if not token:
            return redirect('/login')
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
        except:
            return redirect('/login')
        return f(*args, **kwargs)
    return decorated

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        if User.query.filter_by(username=username).first():
            return render_template('register.html', error="Username taken.")
        hashed_pw = bcrypt.generate_password_hash(password).decode('utf-8')
        user = User(username=username, password=hashed_pw)
        db.session.add(user)
        db.session.commit()
        return redirect('/login')
    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        user = User.query.filter_by(username=username).first()
        if user and bcrypt.check_password_hash(user.password, password):
            token = jwt.encode({'user_id': user.id, 'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)}, app.config['SECRET_KEY'], algorithm="HS256")
            resp = make_response(redirect('/'))
            resp.set_cookie('token', token, httponly=True)
            return resp
        return render_template('login.html', error="Invalid credentials.")
    return render_template('login.html')

@app.route('/logout')
def logout():
    resp = make_response(redirect('/login'))
    resp.set_cookie('token', '', expires=0)
    return resp

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/about')
def about():
    return render_template('about.html')

@app.route('/predict', methods=['POST'])
@token_required
def predict():
    try:
        text = request.form.get('text', '')
        sleep = float(request.form.get('sleep', 0))
        work = float(request.form.get('work', 0))
        screen = float(request.form.get('screen', 0))
        activity = int(request.form.get('activity', 0))

        level = get_prediction(text, sleep, work, screen, activity)
        stress_level = str(level).upper() if level else "UNKNOWN"

        prescriptions = {
            "HIGH": [
                {
                    "game_link": "breathing",
                    "title": "Resonance Breathing",
                    "therapy_goal": "Vagus nerve stimulation to down-regulate cortisol",
                    "clinical_message": "High stress signature. Prioritize autonomic down-regulation via paced respiration and vagal afferent stimulation."
                },
                {
                    "game_link": "shatter",
                    "title": "Kinetic Release (Shatter)",
                    "therapy_goal": "Aggressive kinetic discharge to interrupt stress loops",
                    "clinical_message": "High stress signature. Provide controlled kinetic discharge to reduce acute sympathetic activation and restore agency."
                }
            ],
            "MEDIUM": [
                {
                    "game_link": "bubble",
                    "title": "Bubble Pop",
                    "therapy_goal": "Rhythmic micro-interactions for dopamine-regulation",
                    "clinical_message": "Medium stress signature. Use rhythmic reward feedback to reduce perseveration and regulate attentional loops."
                },
                {
                    "game_link": "particle",
                    "title": "Neural Flow",
                    "therapy_goal": "Flow-state induction to reduce cognitive load",
                    "clinical_message": "Medium stress signature. Induce flow-state engagement to offload rumination and stabilize cognitive rhythm."
                }
            ],
            "LOW": [
                {
                    "game_link": "mandala",
                    "title": "Zen Canvas",
                    "therapy_goal": "Cognitive flow-state maintenance and attentional stability",
                    "clinical_message": "Low stress signature. Maintain baseline through sustained attention and creative symmetry."
                },
                {
                    "game_link": "memory",
                    "title": "Zen Memory",
                    "therapy_goal": "Gentle executive function engagement (prefrontal activation)",
                    "clinical_message": "Low stress signature. Light cognitive intervention to preserve working memory and executive stability."
                }
            ]
        }

        options = prescriptions.get(stress_level, prescriptions["MEDIUM"])
        chosen = random.choice(options)

        return jsonify({
            "status": "success",
            "stress_level": stress_level,
            "clinical_message": chosen["clinical_message"],
            "therapeutic_url": f"/play/{chosen['game_link']}",
            "title": chosen["title"],
            "game_link": chosen["game_link"],
            "therapy_goal": chosen["therapy_goal"]
        }), 200
                               
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/companion_chat', methods=['POST'])
def companion_chat():
    try:
        data = request.get_json()
        user_message = data.get('message', '').lower()
        
        response_text = "Neural patterns stable. Biometric monitoring active. How can I assist your grounding today?"
        
        if any(keyword in user_message for keyword in ['breakup', 'ex', 'lonely']):
            response_text = "Heart rate variability suggests emotional distress. It is okay to feel this way. Let us focus on grounding your current state."
        elif any(keyword in user_message for keyword in ['stress', 'work', 'help', 'exam']):
            response_text = "Acute stress signature detected. Initiating cognitive offloading. Please follow the instructions in your prescribed module."
        elif any(keyword in user_message for keyword in ['anxious', 'panic', 'breathing']):
            response_text = "High sympathetic activation. Prioritize steady respiration. I am here to assist your stabilization."
            
        return jsonify({"response": response_text})
    except Exception:
        return jsonify({"response": "System fault. Please try again."})

@app.route('/games')
@token_required
def arcade():
    return render_template('games.html')

@app.route('/play/<game_name>')
@token_required
def play_game(game_name):
    valid_games = ['particle', 'bubble', 'memory', 'breathing', 'mandala', 'shatter']
    if game_name in valid_games:
        return render_template(f'games/{game_name}.html')
    else:
        return "Game not found", 404

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)