import { useRouter } from "expo-router";
import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Image } from "react-native";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL = "https://zas-backend-production-fb4e.up.railway.app";

export default function LoginScreen() {
  const router = useRouter();
  const [pantalla, setPantalla] = useState("inicio");
  const [telefono, setTelefono] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [foto, setFoto] = useState("");
  const [cargando, setCargando] = useState(false);

  const seleccionarFoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permiso requerido", "Necesitamos acceso a tu galeria"); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true });
    if (!result.canceled) setFoto("data:image/jpeg;base64," + result.assets[0].base64);
  };

  const tomarFoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permiso requerido", "Necesitamos acceso a tu camara"); return; }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true });
    if (!result.canceled) setFoto("data:image/jpeg;base64," + result.assets[0].base64);
  };

  const iniciarSesion = async () => {
    if (!telefono || !password) { Alert.alert("Error", "Ingresa telefono y contrasena"); return; }
    setCargando(true);
    try {
      const res = await fetch(API_URL + "/api/usuarios/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ telefono, password }) });
      const data = await res.json();
      if (data.ok) {
        await AsyncStorage.setItem("usuario_sesion", JSON.stringify(data.usuario));
        router.push("/home");
      } else Alert.alert("Error", data.error || "Telefono o contrasena incorrectos");
    } catch { Alert.alert("Error", "No se pudo conectar"); }
    finally { setCargando(false); }
  };

  const registrarUsuario = async () => {
    if (!nombre || !telefono || !password) { Alert.alert("Error", "Nombre, telefono y contrasena son obligatorios"); return; }
    if (password.length < 4) { Alert.alert("Error", "La contrasena debe tener minimo 4 caracteres"); return; }
    setCargando(true);
    try {
      const res = await fetch(API_URL + "/api/usuarios/registro", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre, telefono, email, password, foto }) });
      const data = await res.json();
      if (data.ok) {
        await AsyncStorage.setItem("usuario_sesion", JSON.stringify(data.usuario));
        Alert.alert("Registro exitoso", "Bienvenido a ZAS, " + data.usuario.nombre);
        router.push("/home");
      } else Alert.alert("Error", data.error || "No se pudo registrar");
    } catch { Alert.alert("Error", "No se pudo conectar"); }
    finally { setCargando(false); }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.logo}>ZAS</Text>
          <Text style={styles.titulo}>Tu mototaxi al instante</Text>
        </View>
        {pantalla === "inicio" && (
          <View style={styles.formulario}>
            <TouchableOpacity style={styles.boton} onPress={() => setPantalla("login")}>
              <Text style={styles.botonTexto}>Iniciar sesion</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.botonOutline} onPress={() => setPantalla("registro")}>
              <Text style={styles.botonOutlineTexto}>Crear cuenta</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.botonConductor} onPress={() => router.push("/conductor")}>
              <Text style={styles.botonConductorTexto}>Soy conductor</Text>
            </TouchableOpacity>
          </View>
        )}
        {pantalla === "login" && (
          <View style={styles.formulario}>
            <Text style={styles.formTitulo}>Iniciar sesion</Text>
            <Text style={styles.label}>Telefono</Text>
            <TextInput style={styles.input} placeholder="3001234567" placeholderTextColor="#888" keyboardType="phone-pad" value={telefono} onChangeText={setTelefono} maxLength={10} />
            <Text style={styles.label}>Contrasena</Text>
            <TextInput style={styles.input} placeholder="Tu contrasena" placeholderTextColor="#888" secureTextEntry value={password} onChangeText={setPassword} />
            <TouchableOpacity style={styles.boton} onPress={iniciarSesion} disabled={cargando}>
              {cargando ? <ActivityIndicator color="#1a1a2e" /> : <Text style={styles.botonTexto}>Entrar</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPantalla("inicio")}>
              <Text style={styles.linkTexto}>Volver</Text>
            </TouchableOpacity>
          </View>
        )}
        {pantalla === "registro" && (
          <View style={styles.formulario}>
            <Text style={styles.formTitulo}>Crear cuenta</Text>
            <View style={styles.fotoContainer}>
              {foto ? <Image source={{ uri: foto }} style={styles.fotoPreview} /> : <View style={styles.fotoPlaceholder}><Text style={styles.fotoPlaceholderTexto}>Sin foto</Text></View>}
              <View style={styles.fotoBotones}>
                <TouchableOpacity style={styles.fotoBoton} onPress={seleccionarFoto}><Text style={styles.fotoBotonTexto}>Galeria</Text></TouchableOpacity>
                <TouchableOpacity style={styles.fotoBoton} onPress={tomarFoto}><Text style={styles.fotoBotonTexto}>Camara</Text></TouchableOpacity>
              </View>
            </View>
            <Text style={styles.label}>Nombre completo *</Text>
            <TextInput style={styles.input} placeholder="Tu nombre" placeholderTextColor="#888" value={nombre} onChangeText={setNombre} />
            <Text style={styles.label}>Telefono *</Text>
            <TextInput style={styles.input} placeholder="3001234567" placeholderTextColor="#888" keyboardType="phone-pad" value={telefono} onChangeText={setTelefono} maxLength={10} />
            <Text style={styles.label}>Contrasena *</Text>
            <TextInput style={styles.input} placeholder="Minimo 4 caracteres" placeholderTextColor="#888" secureTextEntry value={password} onChangeText={setPassword} />
            <Text style={styles.label}>Email (opcional)</Text>
            <TextInput style={styles.input} placeholder="tu@email.com" placeholderTextColor="#888" keyboardType="email-address" value={email} onChangeText={setEmail} />
            <TouchableOpacity style={styles.boton} onPress={registrarUsuario} disabled={cargando}>
              {cargando ? <ActivityIndicator color="#1a1a2e" /> : <Text style={styles.botonTexto}>Registrarme</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPantalla("inicio")}>
              <Text style={styles.linkTexto}>Volver</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1a1a2e" },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 24 },
  header: { alignItems: "center", marginBottom: 40 },
  logo: { fontSize: 48, fontWeight: "bold", color: "#FFD700" },
  titulo: { fontSize: 16, color: "#888", marginTop: 8 },
  formulario: { gap: 12 },
  formTitulo: { fontSize: 22, color: "#fff", fontWeight: "700", marginBottom: 8 },
  label: { color: "#aaa", fontSize: 13, fontWeight: "600" },
  input: { backgroundColor: "#16213e", borderRadius: 10, padding: 14, color: "#fff", fontSize: 15, borderWidth: 1, borderColor: "#0f3460" },
  boton: { backgroundColor: "#FFD700", borderRadius: 12, padding: 16, alignItems: "center", marginTop: 8 },
  botonTexto: { color: "#1a1a2e", fontWeight: "bold", fontSize: 16 },
  botonOutline: { backgroundColor: "transparent", borderRadius: 12, padding: 16, alignItems: "center", borderWidth: 1, borderColor: "#FFD700" },
  botonOutlineTexto: { color: "#FFD700", fontWeight: "bold", fontSize: 16 },
  botonConductor: { backgroundColor: "#16213e", borderRadius: 12, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "#0f3460" },
  botonConductorTexto: { color: "#888", fontWeight: "bold", fontSize: 14 },
  linkTexto: { color: "#888", textAlign: "center", marginTop: 12, fontSize: 14 },
  fotoContainer: { alignItems: "center", marginBottom: 8 },
  fotoPreview: { width: 80, height: 80, borderRadius: 40, marginBottom: 8, borderWidth: 2, borderColor: "#FFD700" },
  fotoPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#16213e", justifyContent: "center", alignItems: "center", marginBottom: 8, borderWidth: 1, borderColor: "#0f3460" },
  fotoPlaceholderTexto: { color: "#555", fontSize: 12 },
  fotoBotones: { flexDirection: "row", gap: 10 },
  fotoBoton: { backgroundColor: "#16213e", borderRadius: 8, padding: 10, borderWidth: 1, borderColor: "#0f3460" },
  fotoBotonTexto: { color: "#aaa", fontSize: 12 },
});
'@ | Out-File -FilePath "C:\Users\jjrch\zas-backend\zas-app\app\login.tsx" -Encoding UTF8 -Force
Write-Host "login.tsx creado correctamente"
