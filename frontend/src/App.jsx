import React, { useState, useEffect, useRef } from 'react';

const VoiceBusinessAssistant = () => {
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