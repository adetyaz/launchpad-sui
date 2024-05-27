module addrx::phygital {
    use sui::url::{Self, Url};
    use std::string::{Self, String};
    use sui::object::{Self,ID, UID};
    use sui::event;
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use std::vector;
    use sui::bcs;
    use sui::clock::{Self, Clock};

    ///// Constants 
    const DESTROYED: u8 = 1; 
    const DAMAGED: u8 = 2; 
    const REPAIRED: u8 = 3; 
    const INUSE: u8 = 4; 
    const ORIGINAL: u8 = 5; 
    //// Error codes
    /// Not an Admin
    const ENotAdmin: u64 = 1;
    const ENotOperator: u64 = 2;
    const ENotCreator: u64 = 3;
    const EInvalidCall: u64 = 4;
    
    /// Objects
    /// @notice Struct representing phygital asset information.
    struct PhygitaInfo has copy,store, drop {
        /// @notice Time of registration.
        is_registerTime: u64,
        /// @notice Unique ID of the phygital asset.
        phygital_id: vector<u8>,
        /// @notice Status of the phygital asset.
        status: u8,
    }

    struct PhygitalNFT has key {
        id: UID,
        //Name of the token.
        name: String,
        /// Description of the token
        description:String,
        ///Url of the token 
        url: Url,
        ///Royalty
        royalty_numerator: u64,
        /// phygital assets info 
        phygital_info: PhygitaInfo,
    }
    
    struct AccessControlCap has key {
        id: UID,
        admin: address,
        operator: vector<address>,
        creator: vector<address>,
    }

    /// Events 
    /// @notice Event emitted when a role is granted.
    struct GrantRoleEvent has copy,drop {
        role_admin: address,
        role_user: address,
        role_type: u8,
    }
     /// @notice Event emitted when a role is revoked.
    struct RevokeRoleEvent has copy,drop {
        role_admin: address,
        role_user: address,
        role_type: u8,
    }
    
    /// @notice Event emitted when the status of a phygital asset is updated.
    struct UpdateStatusEvent has copy,drop {
        previous_status: u8,
        current_status: u8,
        time: u64,
    }
        /// @notice Event emitted when an NFT is minted.
    struct NFTMintedEvent has copy, drop {
        // The Object ID of the NFT
        object_id: ID,
        // The creator of the NFT
        creator: address,
        // The name of the NFT
        name: String,
        //Url oft the NFT,
        url: Url,
        //Phygital Id
        phygital_tag: vector<u8>,
    }

    fun init(ctx: &mut TxContext){
       let access_control = AccessControlCap {
            id: object::new(ctx),
            admin: tx_context::sender(ctx),
            operator: vector::empty(),
            creator: vector::empty(),
        };

        transfer::share_object(access_control);
    }

    entry fun grant_role(
        user: address,roletype: u8,
        controlcap: &mut AccessControlCap , 
        ctx: &TxContext
    ){
        if(roletype == 1){
            assert_is_admin(controlcap,tx_context::sender(ctx));
            vector::push_back(&mut controlcap.operator, user);
            event::emit(GrantRoleEvent{
                role_admin: tx_context::sender(ctx),
                role_user: user,
                role_type: 1,
            })
        }
        else if(roletype == 2){
            assert_is_operator(controlcap,tx_context::sender(ctx));
            vector::push_back(&mut controlcap.creator,user);
            event::emit(GrantRoleEvent{
                role_admin: tx_context::sender(ctx),
                role_user: user,
                role_type: 2,
            })
        } 
        else {
            abort(EInvalidCall)
        }
    }

    entry fun revoke_role(
        user: address,
        roletype: u8,
        controlcap: &mut AccessControlCap , 
        ctx: &TxContext
    ){
        if(roletype == 1){
            assert_is_admin(controlcap,tx_context::sender(ctx));
            let (found,i) = vector::index_of(&controlcap.operator,&user);
            assert!(found,EInvalidCall);
            vector::remove(&mut controlcap.operator, i);
            event::emit(RevokeRoleEvent{
                role_admin: tx_context::sender(ctx),
                role_user: user,
                role_type: 1,
            })
        }
        else if(roletype == 2){
            assert_is_operator(controlcap,tx_context::sender(ctx));
            let (found,i) = vector::index_of(&controlcap.operator,&user);
            assert!(found,EInvalidCall);
            vector::remove(&mut controlcap.creator,i);
            event::emit(RevokeRoleEvent{
                role_admin: tx_context::sender(ctx),
                role_user: user,
                role_type: 2,
            })
        } 
        else {
            abort(EInvalidCall)
        }
    }
    
    entry fun update_item_status(
        nft: &mut PhygitalNFT, 
        status: u8,
        clock: &Clock,
    ){
        if(status == 2){
            nft.phygital_info.status = INUSE;
        } 
        else if(status == 3){
            nft.phygital_info.status = REPAIRED;
        }
        else if(status == 4){
            nft.phygital_info.status = DAMAGED;
        }
        else if(status == 5){
            nft.phygital_info.status = DESTROYED;
        }
        else {
            abort(EInvalidCall)
        };
        event::emit(UpdateStatusEvent{
            previous_status: status - 1,
            current_status: status,
            time: clock::timestamp_ms(clock),
        });
    }

    
    /// @notice Function to mint a new phygital NFT Only by creator role.
    /// @param controlcap The access control capabilities.
    /// @param user The address of the user minting the NFT.
    /// @param nft_name The name of the NFT.
    /// @param nft_description The description of the NFT.
    /// @param uri The URL of the NFT.
    /// @param royalty The royalty information.
    /// @param phygital_tag The unique tag of the phygital asset.
    /// @param clock The clock module for timestamping.
    /// @param ctx The transaction context.
   public entry fun create_asset(
        phygital_tag: String,
        nft_name: String,
        nft_description: String, 
        uri: String,
        royalty: u64,
        controlcap: &AccessControlCap,
        clock: &Clock,
        ctx: &mut TxContext
    ){  
        assert_is_creator(controlcap,tx_context::sender(ctx));
        
        let phygital_info_obj =  PhygitaInfo {
            is_registerTime: clock::timestamp_ms(clock),
            phygital_id: bcs::to_bytes(&phygital_tag),
            status: ORIGINAL,
        };

        let nft = PhygitalNFT {
            id: object::new(ctx),
            name: nft_name,
            description: nft_description,
            url: url::new_unsafe_from_bytes(*string::bytes(&uri)),
            royalty_numerator: royalty,
            phygital_info: phygital_info_obj,
        };

        event::emit(NFTMintedEvent {
            object_id: object::id(&nft),
            creator: tx_context::sender(ctx),
            name: nft.name,
            url: nft.url,
            phygital_tag: phygital_info_obj.phygital_id,

        });

        transfer::transfer(nft,tx_context::sender(ctx));
    }


    
    /// @notice Function to mint a new phygital NFT only by Operator.
    /// @param controlcap The access control capabilities.
    /// @param user The address of the user minting the NFT.
    /// @param nft_name The name of the NFT.
    /// @param nft_description The description of the NFT.
    /// @param uri The URL of the NFT.
    /// @param royalty The royalty information.
    /// @param phygital_tag The unique tag of the phygital asset.
    /// @param clock The clock module for timestamping.
    /// @param ctx The transaction context.
    
    public entry fun delegate_asset_creation(
        user: address,
        phygital_tag: String,
        nft_name: String,
        nft_description: String, 
        uri: String,
        royalty: u64,
        controlcap: &AccessControlCap,
        clock: &Clock,
        ctx: &mut TxContext
    ){  
        assert_is_operator(controlcap,tx_context::sender(ctx));
        let phygital_info_obj =  PhygitaInfo {
            is_registerTime: clock::timestamp_ms(clock),
            phygital_id: bcs::to_bytes(&phygital_tag),
            status: ORIGINAL,
        };

        let nft = PhygitalNFT {
            id: object::new(ctx),
            name: nft_name,
            description: nft_description,
            url: url::new_unsafe_from_bytes(*string::bytes(&uri)),
            royalty_numerator: royalty,
            phygital_info: phygital_info_obj,
        };

        event::emit(NFTMintedEvent {
            object_id: object::id(&nft),
            creator: user,
            name: nft.name,
            url: nft.url,
            phygital_tag: phygital_info_obj.phygital_id,

        });

        transfer::transfer(nft,user);
    }

     /// @notice Function to destroy a phygital asset.
    /// @param nft The phygital NFT to be destroyed.
    /// @param ctx The transaction context.
     entry fun destroy_asset(nft: PhygitalNFT, _: &mut TxContext) {
        let PhygitalNFT { 
            id, 
            name: _, 
            description: _, 
            url: _,
            royalty_numerator: _,
            phygital_info: _,
        } = nft;
        object::delete(id)
    }

    /// @notice Function to set the URL of a token.
    /// @param nft The phygital NFT.
    /// @param nft_url The new URL of the token.
    entry fun set_token_uri(nft: &mut PhygitalNFT, nft_url: String) {
            nft.url =  url::new_unsafe_from_bytes(*string::bytes(&nft_url));
    }

    /// @notice Function to assert that the caller is an admin.
    /// @param controlcap The access control capabilities.
    /// @param user The address of the user.
    fun assert_is_admin(controlcap: &AccessControlCap,user: address){
        assert!(controlcap.admin == user, ENotAdmin);
    }

    /// @notice Function to assert that the caller is an operator.
    /// @param controlcap The access control capabilities.
    /// @param user The address of the user.
    fun assert_is_operator(controlcap: &AccessControlCap,user: address){
        assert!(vector::is_empty(&controlcap.operator), ENotOperator);
        let (found,_) = vector::index_of(&controlcap.operator,&user);
        assert!(found,ENotOperator);
    }

    /// @notice Function to assert that the caller is a creator.
    /// @param controlcap The access control capabilities.
    /// @param user The address of the user.
    fun assert_is_creator(controlcap: &AccessControlCap,user: address){
        assert!(vector::is_empty(&controlcap.creator), ENotCreator);
        let (found,_) = vector::index_of(&controlcap.creator,&user);
        assert!(found,ENotCreator);
    }

}
