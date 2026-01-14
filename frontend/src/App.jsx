import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, TrendingUp, TrendingDown, Package, DollarSign, HelpCircle, BarChart3, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

const VoiceBusinessAssistant = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [activityLog, setActivityLog] = useState([]);
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [inventory, setInventory] = useState({});
  const [summary, setSummary] = useState({ sales: 0, expenses: 0, profit: 0 });
  const [browserSupported, setBrowserSupported] = useState(true);

  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US'; //since ww will have word mixture for english and chichewa

      recognitionRef.current.onresult = (event) => {
        const command = event.results[0][0].transcript.trim();
        setTranscript(command);
        handleCommand(command);
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
        if (event.error === 'no-speech') {
          speak("Sindinamve kalikonse. Yesaninso kupanga record, chonde.");
        } else {
          speak("Ndalephera kumva bwino bwino. Yesaninso kupanga record, chonde.");
        }
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    } else {
      setBrowserSupported(false);
      console.error('Speech recognition not supported');
    }

    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [salesRes, expensesRes, inventoryRes] = await Promise.all([
        fetch('/api/sales'),
        fetch('/api/expenses'),
        fetch('/api/inventory')
      ]);

      const salesData = await salesRes.json();
      const expensesData = await expensesRes.json();
      const invData = await inventoryRes.json();

      setSales(salesData);
      setExpenses(expensesData);
      setInventory(invData);
      calculateSummary(salesData, expensesData);
    } catch (err) {
      console.error('Error loading data:', err);
      speak("Error loading your business data. Please check connection.");
    }
  };

  const calculateSummary = (salesData, expensesData) => {
    const today = new Date().toDateString();
    const totalSales = salesData
      .filter((s) => new Date(s.date).toDateString() === today)
      .reduce((sum, s) => sum + (s.amount || 0), 0);
    const totalExpenses = expensesData
      .filter((e) => new Date(e.date).toDateString() === today)
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    setSummary({
      sales: totalSales,
      expenses: totalExpenses,
      profit: totalSales - totalExpenses,
    });
  };

  const speak = (text) => {
    synthRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'sw-KE';
    utterance.rate = 0.95;
    synthRef.current.speak(utterance);
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setTranscript('');
      recognitionRef.current.start();
    }
    setIsListening(!isListening);
  };

  const handleCommand = async (command) => {
    if (!command) return;

    try {
      const res = await fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      });

      if (!res.ok) {
        throw new Error(`Server responded with ${res.status}`);
      }

      const data = await res.json();

      speak(data.message || "Command processed.");

      addToLog(command, data.message, data.type || (data.success ? 'success' : 'error'));

      if (data.success) {
        loadData(); // refresh all data after successful action
      }
    } catch (err) {
      console.error('Command processing error:', err);
      speak("Ndalephera kunvesesa zomwe mukunena. Yesaninso kapena funsani 'thandizo'.");
      addToLog(command, "Network or server error", "error");
    }
  };

  const addToLog = (command, result, type) => {
    const entry = {
      id: Date.now(),
      time: new Date().toLocaleTimeString(),
      command,
      result,
      type
    };
    setActivityLog((prev) => [entry, ...prev].slice(0, 20));
  };

  const exportData = () => {
    const salesSheet = XLSX.utils.json_to_sheet(sales);
    const expensesSheet = XLSX.utils.json_to_sheet(expenses);

    const inventoryArray = Object.entries(inventory).map(([item, quantity]) => ({
      item,
      quantity,
    }));
    const inventorySheet = XLSX.utils.json_to_sheet(inventoryArray);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, salesSheet, 'Sales');
    XLSX.utils.book_append_sheet(workbook, expensesSheet, 'Expenses');
    XLSX.utils.book_append_sheet(workbook, inventorySheet, 'Inventory');

    XLSX.writeFile(
      workbook,
      `business-data-${new Date().toISOString().split('T')[0]}.xlsx`
    );

    speak('Excel file exported successfully');
  };

  const quickCommand = (cmd) => {
    setTranscript(cmd);
    handleCommand(cmd);
  };

  const reportInventory = () => {
    const items = Object.keys(inventory);
    if (items.length === 0) {
      speak("Mulibe katundu aliyense pakadali pano.");
      addToLog("Stock check", "Inventory is empty", "info");
      return;
    }
    let report = "Katundu wanu pakali pano: ";
    items.forEach((item, i) => {
      report += `${inventory[item]} ${item}`;
      if (i < items.length - 1) report += ", ";
    });
    speak(report);
    addToLog("Stock check", report, "info");
  };

  const reportProfit = (period = "today") => {
    let filteredSales = sales;
    let filteredExpenses = expenses;
    let label = "lero";

    if (period === "week") {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      filteredSales = sales.filter(s => new Date(s.date) >= weekAgo);
      filteredExpenses = expenses.filter(e => new Date(e.date) >= weekAgo);
      label = "sabata ino";
    } else if (period === "month") {
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      filteredSales = sales.filter(s => new Date(s.date) >= monthAgo);
      filteredExpenses = expenses.filter(e => new Date(e.date) >= monthAgo);
      label = "mwezi uno";
    }

    const totalSales = filteredSales.reduce((sum, s) => sum + (s.amount || 0), 0);
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const profit = totalSales - totalExpenses;

    speak(`Phindu lanu ${label} ndi ${profit} Kwacha.`);
    addToLog("Phindu", `${label}: ${profit}`, "info");
  };

  const provideHelp = () => {
    const helpText =
      "Ndingakuthandizeni ndi: kulemba malonda (ndagulitsa ma buku atatu pa 500), " +
      "kulemba zowononga (ndagula shuga pa 3000), " +
      "kuonjezera katundu (ndaonjeza 10 buku ku stock), " +
      "ndi kuonera phindu kapena katundu wanu.";
    speak(helpText);
    addToLog("Thandizo", "Malangizo ofotokozedwa", "info");
  };

  if (!browserSupported) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Browser Siwothandiza</h1>
          <p className="text-gray-600">
            Tsambali imafuna browser yomwe imathandizira Web Speech API.
            Chonde gwiritsani ntchito Chrome, Edge, kapena Safari.
          </p>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 text-center mb-2">
            Voice-Command Business Assistant
          </h1>
          <p className="text-gray-600 text-center">
            Lankhulani Kuti Muzithandize Mmene mukufunira (Chingelezi, Chichewa, kapena kaasakaniza)
          </p>
        </div>

        {/* Summary*/}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-green-500 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Malonda a Lero</p>
                <p className="text-3xl font-bold mt-1">{summary.sales}</p>
              </div>
              <TrendingUp size={40} className="opacity-80" />
            </div>
          </div>
          <div className="bg-red-500 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">tagwilista ntchito Lero</p>
                <p className="text-3xl font-bold mt-1">{summary.expenses}</p>
              </div>
              <TrendingDown size={40} className="opacity-80" />
            </div>
          </div>
          <div className="bg-blue-500 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Phindu la Lero</p>
                <p className="text-3xl font-bold mt-1">{summary.profit}</p>
              </div>
              <DollarSign size={40} className="opacity-80" />
            </div>
          </div>
        </div>

        {/* Voice Control */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <div className="flex flex-col items-center">
            <button
              onClick={toggleListening}
              className={`w-32 h-32 rounded-full flex items-center justify-center transition-all transform hover:scale-105 ${isListening ? 'bg-red-500 animate-pulse shadow-2xl' : 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-xl'
                }`}
            >
              {isListening ? <MicOff size={64} className="text-white" /> : <Mic size={64} className="text-white" />}
            </button>
            <p className="mt-6 text-xl font-semibold text-gray-800">
              {isListening ? 'Ndikumvetsera...' : 'Dinani kuti mulankhule'}
            </p>
            {transcript && (
              <div className="mt-4 p-4 bg-indigo-50 rounded-lg w-full max-w-md">
                <p className="text-sm text-gray-600 mb-1">Mwanena Kut:</p>
                <p className="text-gray-800 font-medium">{transcript}</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions*/}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <button onClick={() => quickCommand("what is my stock")} className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
            <Package size={32} className="text-purple-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-gray-700 text-center">Onani Katundu</p>
          </button>
          <button onClick={() => quickCommand("profit today")} className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
            <DollarSign size={32} className="text-green-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-gray-700 text-center">Phindu Lero</p>
          </button>
          <button onClick={() => quickCommand("summary")} className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
            <BarChart3 size={32} className="text-blue-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-gray-700 text-center">Chidule</p>
          </button>
          <button onClick={() => quickCommand("help")} className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
            <HelpCircle size={32} className="text-orange-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-gray-700 text-center">Thandizo</p>
          </button>
        </div>

        {/* Activity Log */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">Zochitika Zaposachedwa</h2>
            <button
              onClick={exportData}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
            >
              <Download size={18} />
              Export
            </button>
          </div>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {activityLog.length === 0 ? (
              <p className="text-gray-400 text-center py-8">Palibe kalikonse. Yambani kulankhula zomwe mukufuna!</p>
            ) : (
              activityLog.map((entry) => (
                <div
                  key={entry.id}
                  className={`p-4 rounded-lg border-l-4 ${entry.type === 'success' ? 'bg-green-50 border-green-500' :
                    entry.type === 'error' ? 'bg-red-50 border-red-500' :
                      'bg-blue-50 border-blue-500'
                    }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-sm font-semibold text-gray-700">{entry.command}</p>
                    <span className="text-xs text-gray-500">{entry.time}</span>
                  </div>
                  <p className="text-sm text-gray-600">{entry.result}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-gray-600 text-sm">
          <p> Yesani kunena kuti: "Ndagulitsa ma buku atatu pa Mtengo wa 500" kapena "Sold 3 books at 500"</p>
        </div>
      </div>
    </div>
  );
};

export default VoiceBusinessAssistant;