from flask import Flask, request, jsonify, render_template_string

app = Flask(__name__)

# Simple homepage with input form
@app.route('/')
def home():
    return render_template_string('''
        <h2>Sum of Two Numbers</h2>
        <form action="/add" method="post">
            <input type="number" name="num1" placeholder="Enter first number" required>
            <input type="number" name="num2" placeholder="Enter second number" required>
            <button type="submit">Calculate</button>
        </form>
    ''')

# Route to calculate sum
@app.route('/add', methods=['POST'])
def add():
    num1 = int(request.form['num1'])
    num2 = int(request.form['num2'])
    result = num1 + num2
    return f"<h3>Sum of {num1} and {num2} = {result}</h3>"

# API endpoint (optional, for JSON requests)
@app.route('/api/sum', methods=['GET'])
def api_sum():
    num1 = int(request.args.get('num1', 0))
    num2 = int(request.args.get('num2', 0))
    return jsonify({
        "num1": num1,
        "num2": num2,
        "sum": num1 + num2
    })

if __name__ == '__main__':
    app.run(debug=True)
