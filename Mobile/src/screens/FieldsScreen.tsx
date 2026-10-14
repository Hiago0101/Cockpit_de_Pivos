import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
  useWindowDimensions,
} from "react-native";
import {
  Grid3x3,
  Plus,
  Search,
  Edit2,
  Trash2,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
  X,
  Building2,
  ChevronDown,
} from "lucide-react-native";
import { mobileApi } from "../services/api";
import { MobileFarm, MobileField } from "../types";

interface FieldsScreenProps {
  initialFarmFilter?: string;
  initialFarmId?: string;
  onNavigateToFarms?: () => void;
}

export function FieldsScreen({ initialFarmFilter = "ALL", initialFarmId, onNavigateToFarms }: FieldsScreenProps) {
  const { width: screenWidth } = useWindowDimensions();
  const isDesktop = screenWidth >= 768;

  const defaultFilter = initialFarmId || initialFarmFilter || "ALL";

  const [farms, setFarms] = useState<MobileFarm[]>([]);
  const [fields, setFields] = useState<MobileField[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFarmFilter, setSelectedFarmFilter] = useState<string>(defaultFilter);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal de Criação / Edição
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<MobileField | null>(null);
  const [formFazendaId, setFormFazendaId] = useState("");
  const [formCodigo, setFormCodigo] = useState("");
  const [formDescricao, setFormDescricao] = useState("");
  const [formIdPims, setFormIdPims] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal de Exclusão
  const [fieldToDelete, setFieldToDelete] = useState<MobileField | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Seletor de Fazenda no Formulário
  const [showFarmPicker, setShowFarmPicker] = useState(false);

  const loadData = async () => {
    try {
      const [farmsData, fieldsData] = await Promise.all([
        mobileApi.getFarms(),
        mobileApi.getFields(),
      ]);
      setFarms(farmsData);
      setFields(fieldsData);
    } catch (err: any) {
      Alert.alert("Erro", err?.message || "Não foi possível carregar os dados de talhões.");
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  const handleOpenCreate = () => {
    setEditingField(null);
    setFormFazendaId(
      farms.length === 1 ? farms[0].id : selectedFarmFilter !== "ALL" ? selectedFarmFilter : ""
    );
    setFormCodigo("");
    setFormDescricao("");
    setFormIdPims("");
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (field: MobileField) => {
    setEditingField(field);
    setFormFazendaId(field.fazenda);
    setFormCodigo(field.codigo || "");
    setFormDescricao(field.descricao || field.nome || "");
    setFormIdPims(field.id_pims || "");
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSaveField = async () => {
    setModalError(null);

    const cleanFazendaId = formFazendaId.trim();
    const cleanCodigo = formCodigo.trim().toUpperCase();
    const cleanDescricao = formDescricao.trim();

    // 1. Validação de Fazenda
    if (!cleanFazendaId) {
      setModalError("Selecione a fazenda vinculada ao talhão.");
      return;
    }

    // 2. Validação de Código
    if (!cleanCodigo) {
      setModalError("O código do talhão é obrigatório (ex: TAL-01).");
      return;
    }

    // 3. Validação de Descrição
    if (!cleanDescricao) {
      setModalError("A descrição do talhão é obrigatória.");
      return;
    }

    // 4. Validação de duplicidade de código dentro da mesma fazenda
    const codigoDuplicado = fields.find(
      (f) =>
        f.fazenda === cleanFazendaId &&
        f.codigo?.trim().toUpperCase() === cleanCodigo &&
        (!editingField || f.id !== editingField.id)
    );

    if (codigoDuplicado) {
      const farmNome = farms.find((f) => f.id === cleanFazendaId)?.nome || "nesta fazenda";
      setModalError(`Já existe um talhão com o código "${cleanCodigo}" cadastrado na ${farmNome}.`);
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: Partial<MobileField> = {
        fazenda: cleanFazendaId,
        codigo: cleanCodigo,
        descricao: cleanDescricao,
        nome: cleanDescricao.slice(0, 100),
        id_pims: formIdPims.trim() || undefined,
      };

      if (editingField) {
        await mobileApi.updateField(editingField.id, payload);
        Alert.alert("Sucesso", `Talhão "${cleanCodigo}" atualizado com sucesso!`);
      } else {
        await mobileApi.createField(payload);
        Alert.alert("Sucesso", `Talhão "${cleanCodigo}" cadastrado com sucesso!`);
      }

      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      setModalError(err?.message || "Erro ao salvar talhão no servidor.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!fieldToDelete) return;
    const target = fieldToDelete;
    setIsDeleting(true);

    try {
      await mobileApi.deleteField(target.id);
      setFieldToDelete(null);
      Alert.alert("Sucesso", `Talhão "${target.codigo}" excluído com sucesso!`);
      await loadData();
    } catch (err: any) {
      Alert.alert("Erro", err?.message || "Não foi possível excluir o talhão.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyId = (id: string) => {
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredFields = fields.filter((f) => {
    if (selectedFarmFilter !== "ALL" && f.fazenda !== selectedFarmFilter) {
      return false;
    }
    const term = searchTerm.toLowerCase();
    const matchesCodigo = f.codigo?.toLowerCase().includes(term);
    const matchesDescricao = (f.descricao || f.nome || "").toLowerCase().includes(term);
    const matchesFazendaNome = f.fazenda_nome?.toLowerCase().includes(term);
    const matchesId = f.id?.toLowerCase().includes(term);
    const matchesPims = f.id_pims?.toLowerCase().includes(term);
    return matchesCodigo || matchesDescricao || matchesFazendaNome || matchesId || matchesPims;
  });

  const selectedFarmObj = farms.find((f) => f.id === formFazendaId);

  return (
    <View style={styles.container}>
      {/* 1. Header Padronizado */}
      <View style={styles.screenHeader}>
        <View style={styles.screenTitleRow}>
          <View style={styles.screenTitleGroup}>
            <View style={styles.screenIconBox}>
              <Grid3x3 size={20} color="#10b981" />
            </View>
            <View>
              <Text style={styles.screenTitle}>Gestão de Talhões</Text>
              <Text style={styles.screenSubtitle}>
                {fields.length} talhão(ões) cadastrado(s)
              </Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={handleRefresh}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              <RefreshCw size={16} color="#64748b" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.createButton}
              onPress={handleOpenCreate}
              activeOpacity={0.8}
            >
              <Plus size={16} color="#ffffff" />
              <Text style={styles.createButtonText}>Novo</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 2. Barra de Busca Padronizada */}
        <View style={styles.searchBarContainer}>
          <View style={styles.searchBox}>
            <Search size={18} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por código, descrição ou fazenda..."
              placeholderTextColor="#94a3b8"
              value={searchTerm}
              onChangeText={setSearchTerm}
              autoCapitalize="none"
            />
            {searchTerm.length > 0 && (
              <TouchableOpacity onPress={() => setSearchTerm("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={16} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 3. Filtros por Fazenda em Scroll Horizontal Padronizado */}
        {farms.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterChipScroll}
            contentContainerStyle={styles.filterChipContent}
          >
            <TouchableOpacity
              style={[styles.filterChip, selectedFarmFilter === "ALL" && styles.filterChipActive]}
              onPress={() => setSelectedFarmFilter("ALL")}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterChipText, selectedFarmFilter === "ALL" && styles.filterChipTextActive]}>
                Todas as Fazendas ({fields.length})
              </Text>
            </TouchableOpacity>

            {farms.map((f) => {
              const count = fields.filter((field) => field.fazenda === f.id).length;
              const isSelected = selectedFarmFilter === f.id;
              return (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.filterChip, isSelected && styles.filterChipActive]}
                  onPress={() => setSelectedFarmFilter(f.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]} numberOfLines={1}>
                    {f.nome} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* 4. Lista e Cards Padronizados */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#1b7d52" />
          <Text style={styles.loadingText}>Carregando talhões...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredFields}
          keyExtractor={(item, index) => String(item?.id || index)}
          contentContainerStyle={[styles.listContent, isDesktop && styles.listContentDesktop]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={["#10b981"]}
            />
          }
          renderItem={({ item }) => {
            const farmObj = farms.find((f) => f.id === item.fazenda);
            const farmNome = item.fazenda_nome || farmObj?.nome || "Fazenda Vinculada";
            const farmFilial = item.fazenda_filial || farmObj?.filial || farmObj?.codigo || "";

            return (
              <View style={[styles.recordCard, isDesktop && styles.recordCardDesktop]}>
                {/* Linha Superior: Código + Descrição + Ações */}
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardTitleGroup}>
                    <View style={styles.cardIconBox}>
                      <Grid3x3 size={18} color="#10b981" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={styles.cardTitle} numberOfLines={1}>
                          {item.codigo}
                        </Text>
                        <View style={styles.codeTag}>
                          <Text style={styles.codeTagText}>TALHÃO</Text>
                        </View>
                      </View>
                      <Text style={styles.cardSubtitle} numberOfLines={1}>
                        {item.descricao || item.nome || "Sem descrição"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardActionButtons}>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => handleOpenEdit(item)}
                      activeOpacity={0.7}
                    >
                      <Edit2 size={15} color="#0f766e" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionBtnDelete}
                      onPress={() => setFieldToDelete(item)}
                      activeOpacity={0.7}
                    >
                      <Trash2 size={15} color="#dc2626" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Grade de Métricas Padronizada (3 colunas) */}
                <View style={styles.metricsGrid}>
                  <View style={styles.metricCol}>
                    <Text style={styles.metricLabel}>FAZENDA</Text>
                    <Text style={styles.metricValue} numberOfLines={1}>
                      {farmNome}
                    </Text>
                  </View>
                  <View style={styles.metricCol}>
                    <Text style={styles.metricLabel}>FILIAL</Text>
                    <Text style={styles.metricValue}>
                      {farmFilial || "—"}
                    </Text>
                  </View>
                  <View style={styles.metricCol}>
                    <Text style={styles.metricLabel}>ID PIMS</Text>
                    <Text style={styles.metricValue} numberOfLines={1}>
                      {item.id_pims || "—"}
                    </Text>
                  </View>
                </View>

                {/* Rodapé: ID do Sistema com botão de cópia */}
                <View style={styles.cardFooter}>
                  <View style={styles.idGroup}>
                    <Text style={styles.idLabel}>ID:</Text>
                    <Text style={styles.idValue} numberOfLines={1}>
                      {item.id.slice(0, 10)}...
                    </Text>
                    <TouchableOpacity
                      style={styles.copyBtn}
                      onPress={() => handleCopyId(item.id)}
                      activeOpacity={0.7}
                    >
                      {copiedId === item.id ? (
                        <Check size={12} color="#10b981" />
                      ) : (
                        <Copy size={12} color="#64748b" />
                      )}
                      <Text style={styles.copyBtnText}>
                        {copiedId === item.id ? "Copiado!" : "Copiar"}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.statusPill}>
                    <Text style={styles.statusPillText}>Ativo</Text>
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBox}>
                <Grid3x3 size={36} color="#94a3b8" />
              </View>
              <Text style={styles.emptyTitle}>Nenhum talhão encontrado</Text>
              <Text style={styles.emptySubtitle}>
                {searchTerm.length > 0
                  ? "Tente refinar sua busca por código ou fazenda."
                  : farms.length === 0
                  ? "Cadastre primeiro uma fazenda para vincular seus talhões."
                  : "Toque em '+ Novo' para cadastrar o primeiro talhão."}
              </Text>
              {farms.length === 0 && onNavigateToFarms ? (
                <TouchableOpacity
                  style={styles.emptyCreateButton}
                  onPress={onNavigateToFarms}
                  activeOpacity={0.8}
                >
                  <Building2 size={16} color="#ffffff" />
                  <Text style={styles.emptyCreateButtonText}>Cadastrar Fazenda</Text>
                </TouchableOpacity>
              ) : (
                searchTerm.length === 0 && (
                  <TouchableOpacity
                    style={styles.emptyCreateButton}
                    onPress={handleOpenCreate}
                    activeOpacity={0.8}
                  >
                    <Plus size={16} color="#ffffff" />
                    <Text style={styles.emptyCreateButtonText}>Cadastrar Primeiro Talhão</Text>
                  </TouchableOpacity>
                )
              )}
            </View>
          }
        />
      )}

      {/* MODAL: Criar / Editar Talhão */}
      <Modal
        visible={isModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, isDesktop && styles.modalCardDesktop]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={styles.modalHeaderIcon}>
                  <Grid3x3 size={18} color="#10b981" />
                </View>
                <Text style={styles.modalTitle}>
                  {editingField ? "Editar Talhão" : "Novo Talhão"}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsModalOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {modalError && (
              <View style={styles.errorBanner}>
                <AlertCircle size={16} color="#ef4444" />
                <Text style={styles.errorBannerText}>{modalError}</Text>
              </View>
            )}

            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              {/* Seleção de Fazenda */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Fazenda Vinculada *</Text>
                <TouchableOpacity
                  style={styles.pickerSelector}
                  onPress={() => setShowFarmPicker(!showFarmPicker)}
                  activeOpacity={0.8}
                >
                  <Building2 size={16} color="#64748b" />
                  <Text
                    style={[
                      styles.pickerSelectorText,
                      !selectedFarmObj && { color: "#94a3b8" },
                    ]}
                    numberOfLines={1}
                  >
                    {selectedFarmObj
                      ? `${selectedFarmObj.nome} (Filial ${selectedFarmObj.filial || selectedFarmObj.codigo})`
                      : "Selecione uma fazenda..."}
                  </Text>
                  <ChevronDown size={16} color="#64748b" />
                </TouchableOpacity>

                {showFarmPicker && (
                  <View style={styles.pickerDropdown}>
                    <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                      {farms.map((f) => (
                        <TouchableOpacity
                          key={f.id}
                          style={[
                            styles.pickerOption,
                            formFazendaId === f.id && styles.pickerOptionActive,
                          ]}
                          onPress={() => {
                            setFormFazendaId(f.id);
                            setShowFarmPicker(false);
                          }}
                        >
                          <Text
                            style={[
                              styles.pickerOptionText,
                              formFazendaId === f.id && styles.pickerOptionTextActive,
                            ]}
                          >
                            {f.nome} (Filial {f.filial || f.codigo})
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* Campo Código do Talhão */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Código do Talhão *</Text>
                <TextInput
                  style={[styles.input, styles.inputUppercase]}
                  placeholder="Ex: TAL-01"
                  placeholderTextColor="#94a3b8"
                  value={formCodigo}
                  onChangeText={(text) => setFormCodigo(text.toUpperCase())}
                  autoCapitalize="characters"
                />
                <Text style={styles.inputHelp}>Identificador operacional na fazenda.</Text>
              </View>

              {/* Campo Descrição */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Descrição do Talhão *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Talhão Central - Pivô 01"
                  placeholderTextColor="#94a3b8"
                  value={formDescricao}
                  onChangeText={setFormDescricao}
                />
              </View>

              {/* Campo ID PIMS */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>ID PIMS (Opcional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: PIMS-TAL-001"
                  placeholderTextColor="#94a3b8"
                  value={formIdPims}
                  onChangeText={setFormIdPims}
                  maxLength={50}
                />
                <Text style={styles.inputHelp}>
                  Identificador para integrações externas.
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setIsModalOpen(false)}
                disabled={isSubmitting}
              >
                <Text style={styles.modalCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSubmitButton}
                onPress={handleSaveField}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalSubmitButtonText}>
                    {editingField ? "Salvar Alterações" : "Cadastrar Talhão"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL: Confirmação de Exclusão */}
      <Modal
        visible={Boolean(fieldToDelete)}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setFieldToDelete(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.deleteModalCard, isDesktop && styles.modalCardDesktop]}>
            <View style={styles.deleteModalHeader}>
              <View style={styles.deleteIconBadge}>
                <Trash2 size={24} color="#dc2626" />
              </View>
              <Text style={styles.deleteModalTitle}>Confirmar Exclusão</Text>
            </View>

            <Text style={styles.deleteModalMessage}>
              Tem certeza que deseja excluir o talhão{" "}
              <Text style={{ fontWeight: "700", color: "#0f172a" }}>"{fieldToDelete?.codigo}"</Text>
              {fieldToDelete?.descricao ? ` (${fieldToDelete.descricao})` : ""}?
            </Text>

            <Text style={styles.deleteModalWarning}>
              Esta ação é irreversível e removerá o cadastro definitivamente.
            </Text>

            <View style={styles.deleteModalFooter}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setFieldToDelete(null)}
                disabled={isDeleting}
              >
                <Text style={styles.modalCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteModalConfirmButton}
                onPress={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.deleteModalConfirmText}>Confirmar Exclusão</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  screenHeader: {
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  screenTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  screenTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  screenIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    alignItems: "center",
    justifyContent: "center",
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  screenSubtitle: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
    fontWeight: "500",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1b7d52",
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  createButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  searchBarContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0f172a",
    paddingVertical: 0,
  },
  filterChipScroll: {
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  filterChipContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  filterChipActive: {
    backgroundColor: "#1b7d52",
    borderColor: "#1b7d52",
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  filterChipTextActive: {
    color: "#ffffff",
  },

  // Lista e Cards
  listContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 32,
  },
  listContentDesktop: {
    alignItems: "center",
  },
  recordCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  recordCardDesktop: {
    maxWidth: 960,
    width: "100%",
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  cardTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  cardIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
  },
  codeTag: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  codeTagText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#64748b",
  },
  cardSubtitle: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 1,
    fontWeight: "500",
  },
  cardActionButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnDelete: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    alignItems: "center",
    justifyContent: "center",
  },

  // Grade de Métricas
  metricsGrid: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    padding: 10,
    marginBottom: 12,
  },
  metricCol: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a",
  },

  // Rodapé do Card
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 10,
  },
  idGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  idLabel: {
    fontSize: 10,
    color: "#94a3b8",
    fontWeight: "600",
  },
  idValue: {
    fontSize: 11,
    fontFamily: "monospace",
    color: "#64748b",
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "#f1f5f9",
  },
  copyBtnText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748b",
  },
  statusPill: {
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#047857",
  },

  // Estados Centrais e Vazios
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: "#64748b",
    fontWeight: "500",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 18,
  },
  emptyCreateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1b7d52",
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 8,
    marginTop: 16,
  },
  emptyCreateButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },

  // Modais
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    width: "100%",
    maxWidth: 480,
    maxHeight: "90%",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalCardDesktop: {
    maxWidth: 520,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  modalHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
  },
  modalBody: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0f172a",
  },
  inputUppercase: {
    textTransform: "uppercase",
  },
  inputHelp: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 4,
  },
  pickerSelector: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  pickerSelectorText: {
    flex: 1,
    fontSize: 13,
    color: "#0f172a",
  },
  pickerDropdown: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    marginTop: 4,
    overflow: "hidden",
  },
  pickerOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  pickerOptionActive: {
    backgroundColor: "#ecfdf5",
  },
  pickerOptionText: {
    fontSize: 13,
    color: "#334155",
  },
  pickerOptionTextActive: {
    color: "#1b7d52",
    fontWeight: "700",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    marginHorizontal: 20,
    marginTop: 14,
    padding: 10,
    borderRadius: 8,
  },
  errorBannerText: {
    fontSize: 12,
    color: "#b91c1c",
    flex: 1,
    fontWeight: "500",
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  modalCancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
  },
  modalCancelButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  modalSubmitButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#1b7d52",
    minWidth: 120,
    alignItems: "center",
  },
  modalSubmitButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },

  // Modal de Exclusão
  deleteModalCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    width: "100%",
    maxWidth: 440,
    padding: 20,
  },
  deleteModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  deleteIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#fee2e2",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteModalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
  },
  deleteModalMessage: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 20,
    marginBottom: 12,
  },
  deleteModalWarning: {
    fontSize: 11,
    color: "#dc2626",
    marginBottom: 14,
    fontWeight: "500",
  },
  deleteModalFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 8,
  },
  deleteModalConfirmButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#dc2626",
    alignItems: "center",
  },
  deleteModalConfirmText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },
});
