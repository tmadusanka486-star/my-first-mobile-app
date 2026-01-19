import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Keyboard, Linking, Modal, Platform, SafeAreaView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
// Platform එක Import කළා Web ද Mobile ද කියලා බලාගන්න
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

interface Transaction {
  id: string;
  date: string;
  reason: string;
  amount: number;
  type: 'credit' | 'payment';
}

interface Customer {
  id: string;
  customerNo: string;
  name: string;
  mobile: string;
  creditLimit: number;
  balance: number;
  transactions: Transaction[];
}

export default function NayaPotha() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [inputPin, setInputPin] = useState('');
  const CORRECT_PIN = '1234';

  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [creditLimit, setCreditLimit] = useState(''); 
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    const q = query(collection(db, "customers"), orderBy("customerNo"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Customer[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Customer);
      });
      setCustomers(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const totalDue = customers.reduce((sum, c) => sum + (c.balance > 0 ? c.balance : 0), 0);
  const todayDate = new Date().toLocaleDateString();
  const todayCollection = customers.reduce((sum, c) => {
      const todayTrans = c.transactions?.filter(t => t.date === todayDate && t.type === 'payment') || [];
      return sum + todayTrans.reduce((subSum, t) => subSum + t.amount, 0);
  }, 0);

  const handleLogin = () => {
    if (inputPin === CORRECT_PIN) {
        setIsLoggedIn(true);
        setInputPin('');
    } else {
        Alert.alert('වැරදියි', 'PIN අංකය වැරදියි!');
        setInputPin('');
    }
  };

  const addCustomer = async () => {
    if (name.length > 0) {
      const maxNo = customers.reduce((max, obj) => {
        const current = parseInt(obj.customerNo) || 0;
        return current > max ? current : max;
      }, 0);
      const nextNo = maxNo + 1;
      
      let limitVal = 5000;
      if (creditLimit && !isNaN(parseFloat(creditLimit))) {
          limitVal = parseFloat(creditLimit);
      }

      const newCustomer = { 
          customerNo: nextNo.toString(), 
          name: name, 
          mobile: mobile,
          creditLimit: limitVal, 
          balance: 0, 
          transactions: [] 
      };

      try {
        await addDoc(collection(db, "customers"), newCustomer);
        setName(''); setMobile(''); setCreditLimit(''); Keyboard.dismiss();
      } catch (e) {
        Alert.alert("Error", "ඩේටා සේව් උනේ නෑ. ඉන්ටර්නෙට් බලන්න.");
      }
    } else { Alert.alert('Error', 'කරුණාකර නම ඇතුළත් කරන්න'); }
  };

  const deleteCustomer = (id: string) => {
    // Web එකේදි Alert එක වෙනුවට window.confirm පාවිච්චි කරන්න වෙනවා සමහර වෙලාවට,
    // නමුත් React Native Web වල Alert එක වැඩ.
    Alert.alert("Delete", "මෙම පාරිභෝගිකයා ඉවත් කරන්නද?", [
      { text: "නැත", style: "cancel" },
      { text: "ඔව්", onPress: async () => {
          await deleteDoc(doc(db, "customers", id));
      }}
    ]);
  };

  const openTransactionModal = (customer: Customer) => {
    setSelectedCustomer(customer); setModalVisible(true); setAmount(''); setReason('');
  };

  const handleTransaction = async (isCredit: boolean) => {
    if (!amount || isNaN(parseFloat(amount)) || !selectedCustomer) return;
    const value = parseFloat(amount);
    
    if (isCredit) {
        const potentialBalance = selectedCustomer.balance + value;
        const limit = selectedCustomer.creditLimit || 5000;
        if (potentialBalance > limit) {
            Alert.alert("⚠️ ණය සීමාව පැනලා!", "දිගටම කරගෙන යන්නද?", [
                { text: "නැත", style: "cancel" },
                { text: "ඔව්", onPress: () => processTransaction(isCredit, value) }
            ]);
            return;
        }
    }
    processTransaction(isCredit, value);
  };

  const processTransaction = async (isCredit: boolean, value: number) => {
    if (!selectedCustomer) return;

    const newBalance = isCredit ? selectedCustomer.balance + value : selectedCustomer.balance - value;
    const newTransaction: Transaction = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString(),
      reason: reason || (isCredit ? 'ණයට' : 'ගෙවීමක්'),
      amount: value,
      type: isCredit ? 'credit' : 'payment'
    };
    
    const updatedTransactions = [newTransaction, ...(selectedCustomer.transactions || [])];

    const customerRef = doc(db, "customers", selectedCustomer.id);
    await updateDoc(customerRef, {
        balance: newBalance,
        transactions: updatedTransactions
    });

    if (selectedCustomer.mobile) {
        // --- WhatsApp Logic Fixed for Web & Mobile ---
        const sendWhatsApp = () => {
            let phone = selectedCustomer.mobile.replace(/[^0-9]/g, '');
            if (phone.startsWith('0')) phone = '94' + phone.substring(1);
            
            const message = `T&S PowerTech: \nගනුදෙනුව: රු. ${value.toFixed(2)} (${isCredit ? 'ණයට' : 'ගෙවීම්'}). \nමුළු ණය: රු. ${newBalance.toFixed(2)}`;
            
            let url = '';
            if (Platform.OS === 'web') {
                // PC එකේදි Web URL එක
                url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
            } else {
                // Phone එකේදි App URL එක
                url = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(message)}`;
            }

            Linking.openURL(url).catch(err => {
                Alert.alert("Error", "WhatsApp Open කරන්න බැහැ. App එක Install කරලද බලන්න.");
            });
        };

        // Web එකේදි Alert එකේ Button වැඩ කරන්නේ නැති ප්‍රශ්නයක් එන්න පුළුවන් සමහර Browser වල
        // ඒ නිසා කෙලින්ම යවනවා ද කියල අහනවා
        if (Platform.OS === 'web') {
            const confirm = window.confirm("Saved! WhatsApp එකට යවන්නද?");
            if (confirm) sendWhatsApp();
        } else {
            Alert.alert("Saved!", "WhatsApp යවන්නද?", [
                { text: "No", onPress: () => {} },
                { text: "Yes", onPress: sendWhatsApp }
            ]);
        }
    }
    
    setAmount(''); setReason(''); setModalVisible(false);
  };

  const deleteTransaction = async (transactionId: string) => {
    if (!selectedCustomer) return;
    // Web confirmation handle
    if (Platform.OS === 'web') {
         if(!window.confirm("මෙම විස්තරය ඉවත් කරන්නද?")) return;
         await performDelete(transactionId);
    } else {
        Alert.alert("Remove", "මෙම විස්තරය ඉවත් කරන්නද?", [
            { text: "නැත", style: "cancel" },
            { text: "ඔව්", onPress: () => performDelete(transactionId) }
        ]);
    }
  };

  const performDelete = async (transactionId: string) => {
        if (!selectedCustomer) return;
        const transactionToDelete = selectedCustomer.transactions.find(t => t.id === transactionId);
        if (!transactionToDelete) return;
        let reverseAmount = transactionToDelete.type === 'credit' ? -transactionToDelete.amount : transactionToDelete.amount;
        const newBalance = selectedCustomer.balance + reverseAmount;
        const newTransactions = selectedCustomer.transactions.filter(t => t.id !== transactionId);

        const customerRef = doc(db, "customers", selectedCustomer.id);
        await updateDoc(customerRef, {
            balance: newBalance,
            transactions: newTransactions
        });
        setModalVisible(false);
  };

  const filteredCustomers = customers.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || (c.customerNo && c.customerNo.includes(searchQuery)));

  if (!isLoggedIn) {
    return (
        <SafeAreaView style={styles.loginContainer}>
            <StatusBar barStyle="dark-content" backgroundColor="#F5F7FA" />
            <View style={styles.loginCard}>
                <Text style={{fontSize: 50, marginBottom: 10}}>🔒</Text>
                <Text style={styles.loginTitle}>T&S PowerTech</Text>
                <Text style={{color:'#888', marginBottom:20}}>Online System</Text>
                <TextInput style={styles.loginInput} placeholder="PIN" keyboardType="numeric" secureTextEntry maxLength={4} value={inputPin} onChangeText={setInputPin}/>
                <TouchableOpacity style={styles.loginBtn} onPress={handleLogin}><Text style={styles.loginBtnText}>LOGIN</Text></TouchableOpacity>
            </View>
        </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0056D2" />
      
      <View style={styles.header}>
        <View>
            <Text style={styles.headerTitle}>T&S PowerTech</Text>
            <Text style={styles.headerSubtitle}>Online Database Connected 🟢</Text>
        </View>
        <TouchableOpacity onPress={() => setIsLoggedIn(false)}><Text style={{fontSize:22}}>🔒</Text></TouchableOpacity>
      </View>
      
      {loading ? (
        <View style={{flex:1, justifyContent:'center', alignItems:'center'}}>
            <ActivityIndicator size="large" color="#0056D2" />
            <Text>Loading Data...</Text>
        </View>
      ) : (
        <>
        <View style={styles.dashboardRow}>
          <View style={[styles.dashCard, {backgroundColor:'#FFEBEE'}]}>
              <Text style={styles.dashLabel}>මුළු ණය (Due)</Text>
              <Text style={[styles.dashValue, {color:'#D32F2F'}]}>Rs. {totalDue.toFixed(0)}</Text>
          </View>
          <View style={[styles.dashCard, {backgroundColor:'#E8F5E9'}]}>
              <Text style={styles.dashLabel}>අද එකතුව (Today)</Text>
              <Text style={[styles.dashValue, {color:'#388E3C'}]}>Rs. {todayCollection.toFixed(0)}</Text>
          </View>
        </View>

        <FlatList 
            data={filteredCustomers} 
            keyExtractor={item => item.id} 
            contentContainerStyle={{paddingBottom: 20}}
            ListHeaderComponent={
            <>
                <View style={styles.formCard}>
                    <Text style={styles.sectionTitle}>👤 අලුත් කෙනෙක් (Save to Cloud)</Text>
                    <TextInput style={styles.input} placeholder="නම (Name)" value={name} onChangeText={setName} />
                    <TextInput style={styles.input} placeholder="දුරකථන අංකය (Mobile)" keyboardType="phone-pad" value={mobile} onChangeText={setMobile} />
                    <TextInput style={styles.input} placeholder="ණය සීමාව (Default: 5000)" keyboardType="numeric" value={creditLimit} onChangeText={setCreditLimit} />
                    <TouchableOpacity style={styles.addButton} onPress={addCustomer}>
                        <Text style={styles.addButtonText}>☁️ Save Online</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.searchContainer}>
                    <Text style={{fontSize:20, marginRight:10}}>🔍</Text>
                    <TextInput style={styles.searchInput} placeholder="Search..." value={searchQuery} onChangeText={setSearchQuery} />
                </View>
            </>
            }
            renderItem={({ item }) => (
            <TouchableOpacity onPress={() => openTransactionModal(item)} onLongPress={() => deleteCustomer(item.id)} style={styles.customerCard}>
                <View style={styles.avatarContainer}>
                    <Text style={styles.avatarText}>{item.customerNo}</Text>
                </View>
                <View style={{flex:1, marginLeft: 15}}>
                    <Text style={styles.customerName}>{item.name}</Text>
                    {item.balance > (item.creditLimit || 5000) && <Text style={{color:'red', fontSize:10, fontWeight:'bold'}}>⚠️ LIMIT EXCEEDED</Text>}
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
      </>
      )}

      <Modal visible={modalVisible} animationType="slide" transparent={true} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
                <View>
                    <Text style={styles.modalCustomerName}>{selectedCustomer?.name}</Text>
                    <Text style={[styles.modalCustomerNo, {color: selectedCustomer && selectedCustomer.balance > (selectedCustomer.creditLimit || 5000) ? 'red' : '#888'}]}>
                        Limit: {selectedCustomer?.creditLimit}
                    </Text>
                </View>
                <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeIcon}><Text style={{fontSize:20, color:'white'}}>✕</Text></TouchableOpacity>
            </View>

            <View style={styles.balanceDisplay}>
                <Text style={{color:'#555'}}>Current Due:</Text>
                <Text style={{fontSize:32, fontWeight:'bold', color: selectedCustomer && selectedCustomer.balance > 0 ? '#D32F2F' : '#388E3C'}}>
                    Rs. {selectedCustomer?.balance.toFixed(2)}
                </Text>
            </View>
            
            <View style={styles.transactionInputs}>
                <TextInput style={styles.modalInput} placeholder="📝 විස්තරය (උදා: සීනි)" value={reason} onChangeText={setReason} />
                <TextInput style={styles.modalInput} placeholder="💰 මුදල (Rs.)" keyboardType="numeric" value={amount} onChangeText={setAmount} />
            </View>
            
            <View style={styles.actionButtons}>
                <TouchableOpacity style={[styles.actionBtn, {backgroundColor:'#D32F2F'}]} onPress={() => handleTransaction(true)}>
                    <Text style={styles.actionBtnText}>📉 ණයට (+)</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, {backgroundColor:'#388E3C'}]} onPress={() => handleTransaction(false)}>
                    <Text style={styles.actionBtnText}>💵 ගෙවීම් (-)</Text>
                </TouchableOpacity>
            </View>

            <Text style={styles.historyTitle}>📜 ගනුදෙනු ඉතිහාසය</Text>
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
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  loginContainer: { flex: 1, backgroundColor: '#F5F7FA', justifyContent: 'center', alignItems: 'center' },
  loginCard: { width: '80%', backgroundColor: 'white', padding: 30, borderRadius: 20, alignItems: 'center', elevation: 5 },
  loginTitle: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  loginInput: { width: '100%', borderWidth: 1, borderColor: '#DDD', borderRadius: 10, padding: 10, fontSize: 20, textAlign: 'center', marginBottom: 20, letterSpacing: 5 },
  loginBtn: { backgroundColor: '#0056D2', width: '100%', padding: 12, borderRadius: 10, alignItems: 'center' },
  loginBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

  header: { backgroundColor: '#0056D2', paddingVertical: 15, paddingHorizontal: 20, paddingTop: 40, flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  headerTitle: { color: 'white', fontSize: 24, fontWeight: 'bold' },
  headerSubtitle: { color: '#E3F2FD', fontSize: 14 },

  dashboardRow: { flexDirection: 'row', padding: 15, justifyContent: 'space-between' },
  dashCard: { flex: 0.48, padding: 15, borderRadius: 10, alignItems: 'center', elevation: 2 },
  dashLabel: { fontSize: 12, color: '#555', fontWeight: 'bold' },
  dashValue: { fontSize: 18, fontWeight: 'bold', marginTop: 5 },

  formCard: { backgroundColor: 'white', marginHorizontal: 15, padding: 15, borderRadius: 15, elevation: 3, marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#444', marginBottom: 10 },
  input: { backgroundColor: '#F0F2F5', borderRadius: 8, padding: 12, fontSize: 16, color: '#333', marginBottom: 10, width: '100%' },
  addButton: { backgroundColor: '#0056D2', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 5 },
  addButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

  searchContainer: { flexDirection:'row', alignItems:'center', backgroundColor: 'white', marginHorizontal: 15, paddingHorizontal: 15, borderRadius: 10, marginBottom: 10, elevation: 1 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 16 },

  customerCard: { backgroundColor: 'white', marginHorizontal: 15, marginBottom: 10, padding: 15, borderRadius: 12, flexDirection: 'row', alignItems: 'center', elevation: 2 },
  avatarContainer: { width: 45, height: 45, borderRadius: 25, backgroundColor: '#E3F2FD', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#0056D2', fontSize: 18, fontWeight: 'bold' },
  customerName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  customerMobile: { fontSize: 12, color: '#888' },
  balanceText: { fontSize: 16, fontWeight: 'bold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '92%', height: '90%', backgroundColor: 'white', borderRadius: 20, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalCustomerName: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  modalCustomerNo: { fontSize: 12 },
  closeIcon: { backgroundColor: '#0056D2', width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  balanceDisplay: { alignItems: 'center', marginBottom: 20, backgroundColor: '#FAFAFA', padding: 15, borderRadius: 10 },
  transactionInputs: { marginBottom: 15 },
  modalInput: { borderWidth: 1, borderColor: '#EEE', backgroundColor: '#FAFAFA', borderRadius: 10, padding: 10, fontSize: 16, marginBottom: 10 },
  actionButtons: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  actionBtn: { flex: 0.48, padding: 12, borderRadius: 10, alignItems: 'center' },
  actionBtnText: { color: 'white', fontWeight: 'bold', fontSize: 15 },
  historyTitle: { fontSize: 14, fontWeight: 'bold', color: '#888', marginBottom: 10 },
  historyListContainer: { flex: 1, backgroundColor: '#FAFAFA', borderRadius: 10, padding: 10 },
  historyItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderColor: '#EEE' },
  historyDate: { fontSize: 11, color: '#999' },
  historyReason: { fontSize: 14, color: '#333', fontWeight: '500' },
  historyAmount: { fontSize: 14, fontWeight: 'bold' },
});