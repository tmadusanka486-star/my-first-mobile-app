import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Keyboard, Linking, Modal, SafeAreaView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function NayaPotha() {
  // --- Login State ---
  const [isLoggedIn, setIsLoggedIn] = useState(false); // ඇතුලට ගිහින්ද ඉන්නේ?
  const [inputPin, setInputPin] = useState(''); // ගහන PIN එක
  const CORRECT_PIN = '1800'; // මෙතන ඔයාට කැමති නම්බර් එකක් දාගන්න

  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [customers, setCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => { loadData(); }, []);

  const handleLogin = () => {
    if (inputPin === CORRECT_PIN) {
        setIsLoggedIn(true);
        setInputPin('');
    } else {
        Alert.alert('වැරදියි', 'PIN අංකය වැරදියි!');
        setInputPin('');
    }
  };

  const saveData = async (newList) => {
    try {
      const jsonValue = JSON.stringify(newList);
      await AsyncStorage.setItem('@customers_list', jsonValue);
    } catch (e) { console.log('Error'); }
  };

  const loadData = async () => {
    try {
      const jsonValue = await AsyncStorage.getItem('@customers_list');
      if (jsonValue != null) setCustomers(JSON.parse(jsonValue));
    } catch (e) { console.log('Error'); }
  };

  const addCustomer = () => {
    if (name.length > 0) {
      const maxNo = customers.reduce((max, obj) => {
        const current = parseInt(obj.customerNo) || 0;
        return current > max ? current : max;
      }, 0);
      const nextNo = maxNo + 1;
      const newCustomer = { 
          id: Date.now().toString(), 
          customerNo: nextNo.toString(), 
          name: name, 
          mobile: mobile, 
          balance: 0, 
          transactions: [] 
      };
      const updatedList = [...customers, newCustomer];
      setCustomers(updatedList);
      saveData(updatedList);
      setName(''); setMobile(''); Keyboard.dismiss();
    } else { Alert.alert('Error', 'කරුණාකර නම ඇතුළත් කරන්න'); }
  };

  const openTransactionModal = (customer) => {
    setSelectedCustomer(customer); setModalVisible(true); setAmount(''); setReason('');
  };

  const handleTransaction = (isCredit) => {
    if (!amount || isNaN(amount)) return;
    const value = parseFloat(amount);
    const newBalance = isCredit ? selectedCustomer.balance + value : selectedCustomer.balance - value;
    const newTransaction = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString(),
      reason: reason || (isCredit ? 'ණයට' : 'ගෙවීමක්'),
      amount: value,
      type: isCredit ? 'credit' : 'payment'
    };
    
    const updatedList = customers.map(item => {
        if (item.id === selectedCustomer.id) {
            return { ...item, balance: newBalance, transactions: [newTransaction, ...item.transactions || []] };
        }
        return item;
    });

    setCustomers(updatedList); 
    saveData(updatedList);
    setSelectedCustomer(updatedList.find(c => c.id === selectedCustomer.id));
    setAmount(''); setReason('');
  };

  const deleteTransaction = (transactionId) => {
    Alert.alert("Remove Item", "මෙම විස්තරය ඉවත් කර Balance එක නිවැරදි කරන්නද?", [
            { text: "නැත", style: "cancel" },
            { text: "ඔව්", onPress: () => {
                const transactionToDelete = selectedCustomer.transactions.find(t => t.id === transactionId);
                if (!transactionToDelete) return;
                let reverseAmount = transactionToDelete.type === 'credit' ? -transactionToDelete.amount : transactionToDelete.amount;
                const newBalance = selectedCustomer.balance + reverseAmount;
                const newTransactions = selectedCustomer.transactions.filter(t => t.id !== transactionId);
                const updatedList = customers.map(item => item.id === selectedCustomer.id ? { ...item, balance: newBalance, transactions: newTransactions } : item);
                setCustomers(updatedList);
                saveData(updatedList);
                setSelectedCustomer(updatedList.find(c => c.id === selectedCustomer.id));
            }}
        ]
    );
  };

  const sendWhatsApp = () => {
    if (!selectedCustomer.mobile) return;
    let phone = selectedCustomer.mobile.replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) phone = '94' + phone.substring(1);
    const message = `හායි ${selectedCustomer.name}, \n\nණය පොත (Thilina's Shop): \nඔබගේ මුළු ණය මුදල: Rs. ${selectedCustomer.balance.toFixed(2)} යි. \n\nස්තූතියි!`;
    Linking.openURL(`whatsapp://send?phone=${phone}&text=${encodeURIComponent(message)}`);
  };

  const deleteCustomer = (id) => {
    Alert.alert("Delete", "ඉවත් කරන්නද?", [
      { text: "නැත", style: "cancel" },
      { text: "ඔව්", onPress: () => {
          const newList = customers.filter(item => item.id !== id);
          setCustomers(newList);
          saveData(newList);
      }}
    ]);
  };

  const filteredCustomers = customers.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || (c.customerNo && c.customerNo.includes(searchQuery)));

  // --- Login Screen ---
  if (!isLoggedIn) {
    return (
        <SafeAreaView style={styles.loginContainer}>
            <StatusBar barStyle="dark-content" backgroundColor="#F5F7FA" />
            <View style={styles.loginCard}>
                <Text style={{fontSize: 60, marginBottom: 20}}>🔒</Text>
                <Text style={styles.loginTitle}>Welcome Back!</Text>
                <Text style={styles.loginSubtitle}>Thilina's Naya Potha</Text>
                
                <TextInput 
                    style={styles.loginInput} 
                    placeholder="Enter PIN (1234)" 
                    keyboardType="numeric" 
                    secureTextEntry 
                    maxLength={4}
                    value={inputPin}
                    onChangeText={setInputPin}
                />
                
                <TouchableOpacity style={styles.loginBtn} onPress={handleLogin}>
                    <Text style={styles.loginBtnText}>LOGIN</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
  }

  // --- Main App Screen ---
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0056D2" />
      
      <View style={styles.header}>
        <View>
            <Text style={styles.headerTitle}>📚 ණය පොත</Text>
            <Text style={styles.headerSubtitle}>Thilina's Shop</Text>
        </View>
        <TouchableOpacity onPress={() => setIsLoggedIn(false)} style={{padding:10}}>
            <Text style={{fontSize:24}}>🔒</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.formCard}>
        <Text style={styles.sectionTitle}>👤 අලුත් කෙනෙක් එකතු කරන්න</Text>
        <View style={styles.inputRow}>
            <TextInput style={[styles.input, {flex:1}]} placeholder="නම (Name)" value={name} onChangeText={setName} />
        </View>
        <View style={styles.inputRow}>
            <TextInput style={[styles.input, {flex:1}]} placeholder="දුරකථන අංකය (Mobile)" keyboardType="phone-pad" value={mobile} onChangeText={setMobile} />
        </View>
        <TouchableOpacity style={styles.addButton} onPress={addCustomer}>
          <Text style={styles.addButtonText}>➕ Add Customer</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.searchContainer}>
        <Text style={{fontSize:20, marginRight:10}}>🔍</Text>
        <TextInput style={styles.searchInput} placeholder="නම හෝ අංකය සොයන්න..." value={searchQuery} onChangeText={setSearchQuery} />
      </View>
      
      <FlatList 
        data={filteredCustomers} 
        keyExtractor={item => item.id} 
        contentContainerStyle={{paddingBottom: 20}}
        renderItem={({ item }) => (
        <TouchableOpacity onPress={() => openTransactionModal(item)} onLongPress={() => deleteCustomer(item.id)} style={styles.customerCard}>
            <View style={styles.avatarContainer}>
                <Text style={styles.avatarText}>{item.customerNo}</Text>
            </View>
            <View style={{flex:1, marginLeft: 15}}>
                <Text style={styles.customerName}>{item.name}</Text>
                <Text style={styles.customerMobile}>{item.mobile || 'No Number'}</Text>
            </View>
            <View style={{alignItems:'flex-end'}}>
                <Text style={{fontSize:12, color:'#888'}}>Balance</Text>
                <Text style={[styles.balanceText, {color: item.balance > 0 ? '#D32F2F' : '#388E3C'}]}>
                    {item.balance.toFixed(0)}
                </Text>
            </View>
        </TouchableOpacity>
      )} />

      <Modal visible={modalVisible} animationType="slide" transparent={true} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            
            <View style={styles.modalHeader}>
                <View>
                    <Text style={styles.modalCustomerName}>{selectedCustomer?.name}</Text>
                    <Text style={styles.modalCustomerNo}>Customer No: {selectedCustomer?.customerNo}</Text>
                </View>
                <TouchableOpacity onPress={sendWhatsApp} style={styles.whatsappButton}>
                    <Text style={{fontSize:24}}>💬</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.balanceDisplay}>
                <Text style={{color:'#555'}}>Current Due:</Text>
                <Text style={{fontSize:32, fontWeight:'bold', color: selectedCustomer?.balance > 0 ? '#D32F2F' : '#388E3C'}}>
                    Rs. {selectedCustomer?.balance.toFixed(2)}
                </Text>
            </View>
            
            <View style={styles.transactionInputs}>
                <TextInput style={styles.modalInput} placeholder="📝 විස්තරය (උදා: සීනි)" value={reason} onChangeText={setReason} />
                <TextInput style={styles.modalInput} placeholder="💰 මුදල (Rs.)" keyboardType="numeric" value={amount} onChangeText={setAmount} />
            </View>
            
            <View style={styles.actionButtons}>
                <TouchableOpacity style={[styles.actionBtn, {backgroundColor:'#D32F2F'}]} onPress={() => handleTransaction(true)}>
                    <Text style={styles.actionBtnText}>📉 ණයට ගත්තා (+)</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, {backgroundColor:'#388E3C'}]} onPress={() => handleTransaction(false)}>
                    <Text style={styles.actionBtnText}>💵 සල්ලි ගෙව්වා (-)</Text>
                </TouchableOpacity>
            </View>

            <Text style={styles.historyTitle}>📜 ගනුදෙනු ඉතිහාසය (Long press to delete)</Text>
            <View style={styles.historyListContainer}>
                <FlatList
                    data={selectedCustomer?.transactions || []}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <TouchableOpacity onLongPress={() => deleteTransaction(item.id)} style={styles.historyItem}>
                            <View>
                                <Text style={styles.historyDate}>{item.date}</Text>
                                <Text style={styles.historyReason}>{item.reason}</Text>
                            </View>
                            <Text style={[styles.historyAmount, {color: item.type === 'credit' ? '#D32F2F' : '#388E3C'}]}>
                                {item.type === 'credit' ? '+' : '-'} {item.amount.toFixed(0)}
                            </Text>
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={<Text style={{textAlign:'center', color:'#ccc', marginTop:20}}>තවම විස්තර නැත</Text>}
                />
            </View>
            
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  
  // Login Styles
  loginContainer: { flex: 1, backgroundColor: '#F5F7FA', justifyContent: 'center', alignItems: 'center' },
  loginCard: { width: '80%', backgroundColor: 'white', padding: 30, borderRadius: 20, alignItems: 'center', elevation: 5 },
  loginTitle: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  loginSubtitle: { fontSize: 16, color: '#666', marginBottom: 30 },
  loginInput: { width: '100%', borderWidth: 1, borderColor: '#DDD', borderRadius: 10, padding: 15, fontSize: 20, textAlign: 'center', marginBottom: 20, letterSpacing: 5 },
  loginBtn: { backgroundColor: '#0056D2', width: '100%', padding: 15, borderRadius: 10, alignItems: 'center' },
  loginBtnText: { color: 'white', fontWeight: 'bold', fontSize: 18 },

  // Header Styles
  header: { backgroundColor: '#0056D2', paddingVertical: 20, paddingHorizontal: 20, paddingTop: 50, borderBottomRightRadius: 20, borderBottomLeftRadius: 20, elevation: 5, flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  headerTitle: { color: 'white', fontSize: 28, fontWeight: 'bold' },
  headerSubtitle: { color: '#E3F2FD', fontSize: 16 },

  formCard: { backgroundColor: 'white', margin: 15, padding: 15, borderRadius: 15, elevation: 3, marginTop: -20 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#444', marginBottom: 10 },
  inputRow: { flexDirection: 'row', marginBottom: 10 },
  input: { backgroundColor: '#F0F2F5', borderRadius: 8, padding: 12, fontSize: 16, color: '#333' },
  addButton: { backgroundColor: '#0056D2', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 5 },
  addButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

  searchContainer: { flexDirection:'row', alignItems:'center', backgroundColor: 'white', marginHorizontal: 15, paddingHorizontal: 15, borderRadius: 10, marginBottom: 10, elevation: 1 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 16 },

  customerCard: { backgroundColor: 'white', marginHorizontal: 15, marginBottom: 10, padding: 15, borderRadius: 12, flexDirection: 'row', alignItems: 'center', elevation: 2 },
  avatarContainer: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#E3F2FD', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#0056D2', fontSize: 20, fontWeight: 'bold' },
  customerName: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  customerMobile: { fontSize: 14, color: '#888' },
  balanceText: { fontSize: 18, fontWeight: 'bold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '92%', height: '90%', backgroundColor: 'white', borderRadius: 20, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalCustomerName: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  modalCustomerNo: { fontSize: 14, color: '#888' },
  whatsappButton: { backgroundColor: '#E0F2F1', padding: 10, borderRadius: 50 },
  balanceDisplay: { alignItems: 'center', marginBottom: 20, backgroundColor: '#FAFAFA', padding: 15, borderRadius: 10 },
  transactionInputs: { marginBottom: 15 },
  modalInput: { borderWidth: 1, borderColor: '#EEE', backgroundColor: '#FAFAFA', borderRadius: 10, padding: 12, fontSize: 16, marginBottom: 10 },
  actionButtons: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  actionBtn: { flex: 0.48, padding: 15, borderRadius: 10, alignItems: 'center' },
  actionBtnText: { color: 'white', fontWeight: 'bold', fontSize: 15 },
  historyTitle: { fontSize: 14, fontWeight: 'bold', color: '#888', marginBottom: 10 },
  historyListContainer: { flex: 1, backgroundColor: '#FAFAFA', borderRadius: 10, padding: 10 },
  historyItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#EEE' },
  historyDate: { fontSize: 12, color: '#999' },
  historyReason: { fontSize: 15, color: '#333', fontWeight: '500' },
  historyAmount: { fontSize: 15, fontWeight: 'bold' },
  closeButton: { marginTop: 15, padding: 15, backgroundColor: '#F5F5F5', borderRadius: 10, alignItems: 'center' },
  closeButtonText: { color: '#555', fontWeight: 'bold', fontSize: 16 }
});