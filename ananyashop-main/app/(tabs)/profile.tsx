import React, { useState, useEffect } from 'react';
import { Image, ScrollView, Pressable, TouchableOpacity, ActivityIndicator, SafeAreaView, TextInput } from 'react-native';
import { View } from '@/components/Themed';
import { FontAwesome } from '@expo/vector-icons';
import { useAuth } from "@/providers/AuthProvider"
import * as ImagePicker from "expo-image-picker"
import { supabase } from "@/utils/supabase"
import { decode } from "base64-arraybuffer"
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/providers/ThemeProvider'
import CustomAlert from '@/components/CustomAlert';
import { Text } from "@/components/CustomText"
import { LinearGradient } from 'expo-linear-gradient';

export default function Profile() {
  // 1. State Management
  const { session } = useAuth()
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [loading, setLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [newDisplayName, setNewDisplayName] = useState('')
  const { t, i18n } = useTranslation()
  const { theme } = useTheme()
  
  // 2. Alert Configuration
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: '',
    message: '',
    buttons: []
  });

  // 3. Profile Data
  const [profile, setProfile] = useState()

  // 4. Core Functions
  useEffect(() => {
    if (session?.user?.id) {
      fetchProfile();
    }
  }, [session?.user?.id]);

  useEffect(() => {
    (async () => {
      await ImagePicker.requestCameraPermissionsAsync();
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    })();
  }, []);

  const fetchProfile = async () => {
    try {
      if (!session?.user?.id) return;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .eq('id', session.user.id)
        .single();

      if (error) throw error;
      setProfile(data);
      setNewDisplayName(data.display_name || '');
      setAvatarUrl(data.avatar_url);
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const uploadAvatar = async () => {
    try {
      const cameraPermission = await ImagePicker.getCameraPermissionsAsync();
      const libraryPermission = await ImagePicker.getMediaLibraryPermissionsAsync();

      if (!cameraPermission.granted && !libraryPermission.granted) {
        const newCameraPermission = await ImagePicker.requestCameraPermissionsAsync();
        const newLibraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!newCameraPermission.granted && !newLibraryPermission.granted) {
          setAlertConfig({
            visible: true,
            title: t('common.error'),
            message: t('profile.avatar.permissionError'),
            buttons: [
              {
                text: t('common.ok'),
                onPress: () => setAlertConfig(prev => ({ ...prev, visible: false }))
              }
            ]
          });
          return;
        }
      }

      setAlertConfig({
        visible: true,
        title: t('profile.avatar.pickTitle'),
        message: t('profile.avatar.pickMessage'),
        buttons: [
          {
            text: t('profile.avatar.camera'),
            onPress: async () => {
              const cameraPermission = await ImagePicker.getCameraPermissionsAsync();
              if (!cameraPermission.granted) {
                const newPermission = await ImagePicker.requestCameraPermissionsAsync();
                if (!newPermission.granted) {
                  setAlertConfig({
                    visible: true,
                    title: t('common.error'),
                    message: t('profile.avatar.cameraPermissionError'),
                    buttons: [
                      {
                        text: t('common.ok'),
                        onPress: () => setAlertConfig(prev => ({ ...prev, visible: false }))
                      }
                    ]
                  });
                  return;
                }
              }
              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 1,
                base64: true,
              });
              setAlertConfig(prev => ({ ...prev, visible: false }));
              if (!result.canceled) {
                await handleImageResult(result);
              }
            }
          },
          {
            text: t('profile.avatar.gallery'),
            onPress: async () => {
              const libraryPermission = await ImagePicker.getMediaLibraryPermissionsAsync();
              if (!libraryPermission.granted) {
                const newPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (!newPermission.granted) {
                  setAlertConfig({
                    visible: true,
                    title: t('common.error'),
                    message: t('profile.avatar.galleryPermissionError'),
                    buttons: [
                      {
                        text: t('common.ok'),
                        onPress: () => setAlertConfig(prev => ({ ...prev, visible: false }))
                      }
                    ]
                  });
                  return;
                }
              }
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 1,
                base64: true,
              });
              setAlertConfig(prev => ({ ...prev, visible: false }));
              if (!result.canceled) {
                await handleImageResult(result);
              }
            }
          },
          {
            text: t('common.cancel'),
            style: 'cancel',
            onPress: () => setAlertConfig(prev => ({ ...prev, visible: false }))
          }
        ]
      });
    } catch (error) {
      console.error('Error in uploadAvatar:', error);
      setAlertConfig({
        visible: true,
        title: t('common.error'),
        message: t('profile.avatar.error'),
        buttons: [
          {
            text: t('common.ok'),
            onPress: () => setAlertConfig(prev => ({ ...prev, visible: false }))
          }
        ]
      });
    }
  };

  const handleImageResult = async (result) => {
    if (!result.canceled && result.assets[0].base64) {
      try {
        setLoading(true);

        const fileName = `avatar_${session?.user?.id}_${Date.now()}.jpg`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, decode(result.assets[0].base64), {
            contentType: 'image/jpeg',
            upsert: true
          });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);

        const avatarUrl = data.publicUrl;

        const { error: updateError } = await supabase
          .from('profiles')
          .upsert({
            id: session?.user?.id,
            avatar_url: avatarUrl,
            updated_at: new Date().toISOString(),
          });

        if (updateError) throw updateError;
        
        await fetchProfile();
        
      } catch (error) {
        setAlertConfig({
          visible: true,
          title: t('common.error'),
          message: t('profile.avatar.error'),
          buttons: [
            {
              text: t('common.ok'),
              onPress: () => setAlertConfig(prev => ({ ...prev, visible: false }))
            }
          ]
        });
        console.error('Error processing avatar:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const updateDisplayName = async () => {
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: newDisplayName })
        .eq('id', session?.user?.id);

      if (error) throw error;

      setProfile(prev => prev ? {
        ...prev,
        display_name: newDisplayName
      } : undefined);
      
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating display name:', error);
    } finally {
      setLoading(false);
    }
  };

  // สีพื้นหลังและองค์ประกอบตาม theme
  const bgColor = theme === 'dark' ? '#121212' : '#F5F7FA';
  const cardBgColor = theme === 'dark' ? '#1E1E1E' : '#FFFFFF';
  const borderColor = theme === 'dark' ? '#333333' : '#E5E7EB';
  const primaryColor = theme === 'dark' ? '#3B82F6' : '#2563EB';
  const textColor = theme === 'dark' ? '#E5E7EB' : '#374151';
  const secondaryTextColor = theme === 'dark' ? '#9CA3AF' : '#6B7280';
  
  const getGradientColors = () => {
    return theme === 'dark' 
      ? ['#1E293B', '#0F172A'] 
      : ['#EFF6FF', '#DBEAFE'];
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bgColor }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header Profile Section with Gradient */}
        <LinearGradient
          colors={getGradientColors()}
          style={{ 
            paddingTop: 30,
            paddingBottom: 40,
            borderBottomLeftRadius: 30,
            borderBottomRightRadius: 30
          }}
        >
          <View className="items-center" style={{ backgroundColor: 'transparent' }}>
            <TouchableOpacity 
              onPress={uploadAvatar} 
              disabled={loading}
              style={{
                elevation: 10,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 5 },
                shadowOpacity: 0.3,
                shadowRadius: 10,
              }}
            >
              <View style={{
                padding: 3,
                borderRadius: 100,
                backgroundColor: cardBgColor,
              }}>
                <Image
                  source={{ 
                    uri: `${profile?.avatar_url || 'https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png'}?t=${Date.now()}`,
                    cache: 'reload'
                  }}
                  style={{
                    width: 110,
                    height: 110,
                    borderRadius: 55,
                    borderWidth: 4,
                    borderColor: primaryColor
                  }}
                />
                {loading && (
                  <View className="absolute w-full h-full items-center justify-center bg-black/30 rounded-full">
                    <ActivityIndicator color="#fff" size="large" />
                  </View>
                )}
              </View>
              <View 
                style={{ 
                  position: 'absolute', 
                  bottom: 0, 
                  right: 0, 
                  backgroundColor: primaryColor,
                  padding: 8,
                  borderRadius: 20,
                  borderWidth: 3,
                  borderColor: cardBgColor
                }}
              >
                <FontAwesome name="camera" size={16} color="#FFF" />
              </View>
            </TouchableOpacity>
            
            {isEditing ? (
              <View className="mt-4 w-full px-4">
                <TextInput
                  value={newDisplayName}
                  onChangeText={setNewDisplayName}
                  style={{ 
                    backgroundColor: cardBgColor,
                    borderColor: borderColor,
                    borderWidth: 1,
                    borderRadius: 12,
                    paddingHorizontal: 15,
                    paddingVertical: 10,
                    color: textColor,
                    fontSize: 18,
                    textAlign: 'center',
                    marginBottom: 10,
                    fontFamily: i18n.language === 'th' ? 'NotoSansThai-Medium' : 'Poppins-Medium' 
                  }}
                  placeholderTextColor={secondaryTextColor}
                  autoFocus
                />
                <View className="flex-row justify-center mt-2 space-x-3">
                  <TouchableOpacity 
                    onPress={updateDisplayName}
                    style={{
                      backgroundColor: primaryColor,
                      paddingVertical: 10,
                      paddingHorizontal: 20,
                      borderRadius: 12,
                      elevation: 3,
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.1,
                      shadowRadius: 3,
                    }}
                  >
                    <Text className="!text-white font-medium">
                      {t('profile.editName.save')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => {
                      setIsEditing(false)
                      setNewDisplayName(profile?.display_name || '')
                    }}
                    style={{
                      backgroundColor: theme === 'dark' ? '#4B5563' : '#9CA3AF',
                      paddingVertical: 10,
                      paddingHorizontal: 20,
                      borderRadius: 12,
                    }}
                  >
                    <Text className="!text-white font-medium">
                      {t('profile.editName.cancel')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={{ backgroundColor: 'transparent', alignItems: 'center', marginTop: 15 }}>
                <TouchableOpacity 
                  onPress={() => setIsEditing(true)}
                  style={{ flexDirection: 'row', alignItems: 'center' }}
                >
                  <Text 
                    style={{
                      fontSize: 24,
                      color: theme === 'dark' ? '#FFFFFF' : '#111827',
                      fontFamily: i18n.language === 'th' ? 'NotoSansThai-Bold' : 'Poppins-Bold',
                      marginRight: 5
                    }}
                  >
                    {profile?.display_name || t('profile.noName')}
                  </Text>
                  <FontAwesome name="pencil" size={16} color={primaryColor} />
                </TouchableOpacity>
                
                <Text 
                  style={{
                    color: primaryColor,
                    fontSize: 16,
                    marginTop: 5,
                    fontFamily: i18n.language === 'th' ? 'NotoSansThai-Regular' : 'Poppins-Regular'
                  }}
                >
                  {session?.user?.email}
                </Text>
              </View>
            )}
          </View>
        </LinearGradient>

        <View style={{ padding: 16, backgroundColor: 'transparent' }}>
          {/* Stats Section */}
          <View 
            style={{
              flexDirection: 'row',
              justifyContent: 'space-around',
              backgroundColor: cardBgColor,
              borderRadius: 16,
              padding: 15,
              marginTop: -25,
              marginHorizontal: 16,
              borderWidth: 1,
              borderColor: borderColor,
              elevation: 5,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 3,
            }}
          >
            <View style={{ alignItems: 'center', backgroundColor: 'transparent' }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: primaryColor }}>254</Text>
              <Text style={{ color: secondaryTextColor }}>{t('profile.stats.followers')}</Text>
            </View>
            <View style={{ alignItems: 'center', backgroundColor: 'transparent' }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: primaryColor }}>46</Text>
              <Text style={{ color: secondaryTextColor }}>{t('profile.stats.following')}</Text>
            </View>
            <View style={{ alignItems: 'center', backgroundColor: 'transparent' }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: primaryColor }}>18</Text>
              <Text style={{ color: secondaryTextColor }}>{t('profile.stats.products')}</Text>
            </View>
          </View>

          {/* Quick Actions */}
          <View style={{ marginTop: 25, marginBottom: 15 }}>
            <View 
              style={{ 
                flexDirection: 'row', 
                flexWrap: 'wrap', 
                justifyContent: 'space-between',
                backgroundColor: 'transparent',
              }}
            >
              <ActionButton 
                icon="heart" 
                text={t('profile.buttons.saved')}
                bgColor={cardBgColor}
                iconColor={theme === 'dark' ? '#F87171' : '#EF4444'}
                borderColor={borderColor}
                onPress={() => console.log('Pressed: Saved')}
              />
              
              <ActionButton
                icon="envelope"
                text={t('profile.buttons.messages')}
                bgColor={cardBgColor}
                iconColor={theme === 'dark' ? '#60A5FA' : '#3B82F6'}
                borderColor={borderColor}
                onPress={() => console.log('Pressed: Messages')}
              />
              
              <ActionButton
                icon="star"
                text={t('profile.buttons.reviews')}
                bgColor={cardBgColor}
                iconColor={theme === 'dark' ? '#FBBF24' : '#F59E0B'}
                borderColor={borderColor}
                onPress={() => console.log('Pressed: Reviews')}
              />
              
              <ActionButton
                icon="clock-o"
                text={t('profile.buttons.recent')}
                bgColor={cardBgColor}
                iconColor={theme === 'dark' ? '#A78BFA' : '#8B5CF6'}
                borderColor={borderColor}
                onPress={() => console.log('Pressed: Recent')}
              />
            </View>
          </View>

          {/* Sections with new design */}
          <EnhancedSection 
            title={t('profile.sections.selling.title')} 
            icon="shopping-bag"
            bgColor={cardBgColor}
            borderColor={borderColor}
            textColor={textColor}
            secondaryColor={secondaryTextColor}
            theme={theme}
          >
            <SectionItem 
              icon="list" 
              text={t('profile.sections.selling.products')} 
              theme={theme}
              cardBgColor={cardBgColor}
              textColor={textColor}
            />
            <Divider color={borderColor} />
            <SectionItem 
              icon="bolt" 
              text={t('profile.sections.selling.quickActions')} 
              theme={theme}
              cardBgColor={cardBgColor}
              textColor={textColor}
            />
            <Divider color={borderColor} />
            <SectionItem 
              icon="users" 
              text={t('profile.sections.selling.followers')} 
              theme={theme}
              cardBgColor={cardBgColor}
              textColor={textColor}
            />
            <Divider color={borderColor} />
            <SectionItem 
              icon="line-chart" 
              text={t('profile.sections.selling.activities')} 
              theme={theme}
              cardBgColor={cardBgColor}
              textColor={textColor}
            />
          </EnhancedSection>

          <EnhancedSection 
            title={t('profile.sections.settings.title')} 
            icon="cog"
            bgColor={cardBgColor}
            borderColor={borderColor}
            textColor={textColor}
            secondaryColor={secondaryTextColor}
            theme={theme}
          >
            <SectionItem 
              icon="cog" 
              text={t('profile.sections.settings.following')} 
              theme={theme}
              cardBgColor={cardBgColor}
              textColor={textColor}
            />
          </EnhancedSection>

          <EnhancedSection 
            title={t('profile.sections.account.title')} 
            icon="user-circle"
            bgColor={cardBgColor}
            borderColor={borderColor}
            textColor={textColor}
            secondaryColor={secondaryTextColor}
            theme={theme}
          >
            <SectionItem 
              icon="map-marker" 
              text={t('profile.sections.account.location')} 
              theme={theme}
              cardBgColor={cardBgColor}
              textColor={textColor}
            />
            <Divider color={borderColor} />
            <SectionItem 
              icon="lock" 
              text={t('profile.sections.account.security')} 
              theme={theme}
              cardBgColor={cardBgColor}
              textColor={textColor}
            />
          </EnhancedSection>
        </View>
      </ScrollView>
      
      <CustomAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
      />
    </SafeAreaView>
  );
}

// Helper Components with enhanced styling
const ActionButton = ({ icon, text, bgColor, iconColor, borderColor, onPress }) => {
  return (
    <Pressable
      style={{
        width: '48%',
        backgroundColor: bgColor,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: borderColor,
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      }}
      android_ripple={{ color: 'rgba(104, 104, 104, 0.3)' }}
      onPress={onPress}
    >
      <View style={{ 
        backgroundColor: iconColor + '20', // 20 adds transparency to the color
        width: 50,
        height: 50,
        borderRadius: 25,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10
      }}>
        <FontAwesome name={icon} size={24} color={iconColor} />
      </View>
      <Text style={{ textAlign: 'center', fontWeight: '500' }}>{text}</Text>
    </Pressable>
  );
};

const EnhancedSection = ({ title, icon, children, bgColor, borderColor, textColor, secondaryColor, theme }) => {
  return (
    <View style={{ 
      marginBottom: 20,
      backgroundColor: 'transparent'
    }}>
      <View style={{ 
        flexDirection: 'row', 
        alignItems: 'center', 
        marginBottom: 12,
        paddingHorizontal: 5,
        backgroundColor: 'transparent'
      }}>
        <FontAwesome name={icon} size={18} color={secondaryColor} style={{ marginRight: 8 }} />
        <Text style={{ 
          fontSize: 18, 
          color: textColor,
          fontWeight: '600'
        }}>{title}</Text>
      </View>
      
      <View style={{ 
        backgroundColor: bgColor,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: borderColor,
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      }}>
        {children}
      </View>
    </View>
  );
};

const SectionItem = ({ icon, text, onPress, theme, cardBgColor, textColor }) => {
  return (
    <Pressable
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: cardBgColor
      }}
      onPress={onPress || (() => console.log(`Pressed: ${text}`))}
      android_ripple={{ color: 'rgba(104, 104, 104, 0.3)' }}
    >
      <View style={{ 
        flexDirection: 'row', 
        alignItems: 'center', 
        flex: 1,
        backgroundColor: 'transparent'
      }}>
        <FontAwesome name={icon} size={20} color={textColor} style={{ marginRight: 16 }} />
        <Text style={{ 
          flex: 1,
          fontSize: 16,
          color: textColor
        }}>{text}</Text>
      </View>
      <FontAwesome name="chevron-right" size={16} color={theme === 'dark' ? '#6B7280' : '#9CA3AF'} />
    </Pressable>
  );
};

const Divider = ({ color }) => (
  <View style={{ height: 1, backgroundColor: color }} />
);